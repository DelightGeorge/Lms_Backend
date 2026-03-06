// src/controllers/paymentController.js
//
// Handles Paystack initialization, verification, webhooks, refunds,
// and free-course enrollment.  Revenue splitting is delegated to
// revenueService so this file stays thin.
//
const prisma          = require("../prisma");
const https           = require("https");
const { notify }      = require("../utils/notificationHelper");
const revenueService  = require("../services/revenueService");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: complete enrollment + record revenue after any successful payment
// Idempotent — safe to call from both verifyPayment and webhook.
// ─────────────────────────────────────────────────────────────────────────────
const completeEnrollment = async (userId, courseId, reference) => {
  // 1. Guard: already enrolled?
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return;

  // 2. Load course + payment record
  const [course, payment] = await Promise.all([
    prisma.course.findUnique({
      where:   { id: courseId },
      include: { instructor: { select: { id: true, fullName: true } } },
    }),
    prisma.payment.findUnique({ where: { reference } }),
  ]);
  if (!course || !payment) return;

  // 3. Create enrollment
  await prisma.enrollment.create({ data: { userId, courseId } });

  // 4. Mark payment COMPLETED
  await prisma.payment.update({
    where: { id: payment.id },
    data:  { status: "COMPLETED" },
  });

  // 5. Record instructor earning (adds to pendingBalance, creates ledger row)
  await revenueService.recordEarning({
    paymentId:     payment.id,
    instructorId:  course.instructorId,
    amount:        payment.instructorEarning,
    saleSource:    payment.saleSource,
    availableAfter: payment.availableAfter,
  });

  // 6. Notifications
  const [student, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
  ]);

  await notify({
    userId,
    title:   "✅ Payment Successful — You're Enrolled!",
    message: `Your payment was confirmed and you're now enrolled in "${course.title}". Start learning anytime!`,
    type:    "PAYMENT",
  });

  await notify({
    userId:  course.instructorId,
    title:   "🎉 New Paid Enrollment",
    message: `${student?.fullName || "A student"} enrolled in "${course.title}". You earned $${payment.instructorEarning.toFixed(2)} (${payment.saleSource === "INSTRUCTOR" ? "97%" : "37%"} share). Pending for 30 days.`,
    type:    "ENROLLMENT",
  });

  for (const admin of admins) {
    await notify({
      userId:  admin.id,
      title:   "💳 New Course Purchase",
      message: `${student?.fullName || "A student"} purchased "${course.title}" for $${payment.amount}. Platform fee: $${payment.platformFee.toFixed(2)}.`,
      type:    "PAYMENT",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/initialize
// Body: { courseId, couponCode? }
// ─────────────────────────────────────────────────────────────────────────────
exports.initializePayment = async (req, res) => {
  try {
    const userId              = req.user.id;
    const { courseId, couponCode, referral } = req.body;

    const user   = await prisma.user.findUnique({ where: { id: userId } });
    const course = await prisma.course.findUnique({ where: { id: courseId } });

    if (!course)              return res.status(404).json({ message: "Course not found" });
    if (course.status !== "PUBLISHED") return res.status(400).json({ message: "Course is not published" });
    if (course.price === 0)   return res.status(400).json({ message: "Course is free — use /enroll/free" });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return res.status(400).json({ message: "Already enrolled" });

    // ── Coupon / referral validation ─────────────────────────────
    const couponResult = await revenueService.validateCoupon(couponCode, courseId);

    // Referral param (e.g. ?ref=instructor123) also counts as instructor-sourced
    let saleSource = couponResult.saleSource;
    if (referral) saleSource = "INSTRUCTOR";

    // ── Calculate final price after discount ─────────────────────
    let finalPrice = course.price;
    if (couponResult.valid && couponResult.discountPct > 0) {
      finalPrice = parseFloat((course.price * (1 - couponResult.discountPct / 100)).toFixed(2));
    }

    // ── Revenue split ─────────────────────────────────────────────
    const split = revenueService.calculateSplit(finalPrice, saleSource);

    // ── 30-day hold date ─────────────────────────────────────────
    const availableAfter = new Date();
    availableAfter.setDate(availableAfter.getDate() + revenueService.HOLD_DAYS);

    // ── Create pending Payment row ────────────────────────────────
    // Reference will be filled from Paystack response; use a temp placeholder
    const tempRef = `INIT_${userId}_${courseId}_${Date.now()}`;

    const payment = await prisma.payment.create({
      data: {
        reference:         tempRef,
        amount:            finalPrice,
        status:            "PENDING",
        userId,
        courseId,
        saleSource,
        platformFeeRate:   split.platformFeeRate,
        platformFee:       split.platformFee,
        instructorEarning: split.instructorEarning,
        availableAfter,
        couponCode:        couponResult.valid ? couponCode?.toUpperCase() : null,
      },
    });

    // ── Increment coupon usage ────────────────────────────────────
    if (couponResult.valid && couponResult.coupon) {
      await prisma.coupon.update({
        where: { id: couponResult.coupon.id },
        data:  { usageCount: { increment: 1 } },
      });
    }

    // ── Initialize Paystack transaction ──────────────────────────
    const callbackUrl = `${process.env.PAYSTACK_CALLBACK_URL}?courseId=${courseId}`;
    const params = JSON.stringify({
      email:        user.email,
      amount:       Math.round(finalPrice * 100), // Paystack expects kobo
      currency:     "NGN",
      callback_url: callbackUrl,
      metadata:     { userId, courseId, paymentId: payment.id, courseTitle: course.title },
    });

    const options = {
      hostname: "api.paystack.co",
      port:     443,
      path:     "/transaction/initialize",
      method:   "POST",
      headers:  { Authorization: `Bearer ${PAYSTACK_SECRET}`, "Content-Type": "application/json" },
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = "";
      paystackRes.on("data", (chunk) => { data += chunk; });
      paystackRes.on("end",  async () => {
        const response = JSON.parse(data);
        if (response.status) {
          // Update Payment row with the real Paystack reference
          await prisma.payment.update({
            where: { id: payment.id },
            data:  { reference: response.data.reference },
          });

          res.status(200).json({
            authorizationUrl: response.data.authorization_url,
            reference:        response.data.reference,
            amount:           finalPrice,
            originalPrice:    course.price,
            discount:         course.price - finalPrice,
            split: {
              saleSource,
              instructorEarning: split.instructorEarning,
              platformFee:       split.platformFee,
            },
          });
        } else {
          // Clean up the pending payment row
          await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
          res.status(400).json({ message: response.message });
        }
      });
    });

    paystackReq.on("error", async (err) => {
      console.error(err);
      await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
      res.status(500).json({ message: "Payment initialization failed" });
    });
    paystackReq.write(params);
    paystackReq.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to initialize payment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/verify/:reference
// Called by the frontend after Paystack redirects back.
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    const options = {
      hostname: "api.paystack.co",
      port:     443,
      path:     `/transaction/verify/${reference}`,
      method:   "GET",
      headers:  { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = "";
      paystackRes.on("data", (chunk) => { data += chunk; });
      paystackRes.on("end",  async () => {
        const response = JSON.parse(data);

        if (response.status && response.data.status === "success") {
          const { userId, courseId } = response.data.metadata;
          await completeEnrollment(userId, courseId, reference);
          res.status(200).json({ message: "Payment verified and enrollment complete", success: true, courseId });
        } else {
          // Mark payment as FAILED
          await prisma.payment.updateMany({
            where: { reference, status: "PENDING" },
            data:  { status: "FAILED" },
          });
          res.status(400).json({ message: "Payment not successful", success: false });
        }
      });
    });

    paystackReq.on("error", (err) => {
      console.error(err);
      res.status(500).json({ message: "Verification failed" });
    });
    paystackReq.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/webhook
// Paystack server-to-server webhook — the reliable fallback.
// ─────────────────────────────────────────────────────────────────────────────
exports.webhook = async (req, res) => {
  try {
    const crypto = require("crypto");
    const hash   = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { userId, courseId } = data.metadata || {};
      if (userId && courseId) {
        await completeEnrollment(userId, courseId, data.reference);
      }
    }

    // Paystack expects a fast 200 response
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Webhook error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/enroll/free
// Body: { courseId }
// Zero-price courses skip Paystack entirely.
// ─────────────────────────────────────────────────────────────────────────────
exports.freeEnroll = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { courseId } = req.body;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course)              return res.status(404).json({ message: "Course not found" });
    if (course.price > 0)     return res.status(400).json({ message: "Course is not free — use /initialize" });
    if (course.status !== "PUBLISHED") return res.status(400).json({ message: "Course is not published" });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return res.status(400).json({ message: "Already enrolled" });

    await prisma.enrollment.create({ data: { userId, courseId } });

    const [student, admins] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
      prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
    ]);

    await notify({
      userId,
      title:   "🎉 Enrolled Successfully!",
      message: `You're now enrolled in "${course.title}". It's free — start learning now!`,
      type:    "ENROLLMENT",
    });

    await notify({
      userId:  course.instructorId,
      title:   "👤 New Free Enrollment",
      message: `${student?.fullName || "A student"} enrolled for free in "${course.title}".`,
      type:    "ENROLLMENT",
    });

    for (const admin of admins) {
      await notify({
        userId:  admin.id,
        title:   "📚 Free Enrollment",
        message: `${student?.fullName || "A student"} enrolled for free in "${course.title}".`,
        type:    "ENROLLMENT",
      });
    }

    res.status(200).json({ message: "Enrolled successfully", courseId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to enroll" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/refund/:paymentId  (Admin only)
// Body: { reason? }
// ─────────────────────────────────────────────────────────────────────────────
exports.processRefund = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const { paymentId } = req.params;
    const reason        = req.body.reason || "Admin-issued refund";

    const result = await revenueService.handleRefund(paymentId, reason);

    // Remove the enrollment so the student loses access
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (payment) {
      await prisma.enrollment.deleteMany({
        where: { userId: payment.userId, courseId: payment.courseId },
      });
    }

    res.status(200).json({ message: "Refund processed successfully", ...result });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || "Failed to process refund" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/history  (Student: own payments)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where:   { userId: req.user.id },
      include: { course: { select: { id: true, title: true, thumbnail: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/admin/all  (Admin: all payments)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const payments = await prisma.payment.findMany({
      include: {
        course: { select: { id: true, title: true } },
        user:   { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    100,
    });
    res.status(200).json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};
