// src/controllers/paymentController.js
const prisma         = require("../prisma");
const https          = require("https");
const { notify }     = require("../utils/notificationHelper");

// revenueService is optional — only loaded if the Payment table exists
let revenueService;
try { revenueService = require("../services/revenueService"); } catch (_) {}

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: make a Paystack HTTPS request and return the parsed JSON body
// ─────────────────────────────────────────────────────────────────────────────
const paystackRequest = (options, body = null) =>
  new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end",  () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });

// ─────────────────────────────────────────────────────────────────────────────
// Helper: complete enrollment + record revenue after any confirmed payment
// Safe to call from both verifyPayment and the webhook (idempotent).
// ─────────────────────────────────────────────────────────────────────────────
const completeEnrollment = async (userId, courseId, reference, metadata = {}) => {
  // Already enrolled? Nothing to do.
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return;

  const course = await prisma.course.findUnique({
    where:   { id: courseId },
    include: { instructor: { select: { id: true, fullName: true } } },
  });
  if (!course) return;

  // Create enrollment
  await prisma.enrollment.create({ data: { userId, courseId } });

  // ── Revenue recording (only if Payment table exists & revenueService loaded) ──
  try {
    if (revenueService) {
      // Find or create the Payment row for this reference
      let payment = await prisma.payment.findUnique({ where: { reference } }).catch(() => null);

      if (!payment) {
        // Build a minimal payment record from Paystack metadata
        const amount     = metadata.amount ? metadata.amount / 100 : course.price; // kobo → naira
        const saleSource = metadata.saleSource || "PLATFORM";
        const split      = revenueService.calculateSplit(amount, saleSource);
        const availableAfter = new Date();
        availableAfter.setDate(availableAfter.getDate() + revenueService.HOLD_DAYS);

        payment = await prisma.payment.create({
          data: {
            reference,
            amount,
            status:            "COMPLETED",
            userId,
            courseId,
            saleSource,
            platformFeeRate:   split.platformFeeRate,
            platformFee:       split.platformFee,
            instructorEarning: split.instructorEarning,
            availableAfter,
          },
        }).catch(() => null);
      } else {
        await prisma.payment.update({
          where: { id: payment.id },
          data:  { status: "COMPLETED" },
        }).catch(() => {});
      }

      if (payment) {
        await revenueService.recordEarning({
          paymentId:     payment.id,
          instructorId:  course.instructorId,
          amount:        payment.instructorEarning,
          saleSource:    payment.saleSource,
          availableAfter: payment.availableAfter,
        }).catch(console.error);
      }
    }
  } catch (revErr) {
    // Revenue recording failure must never block enrollment
    console.error("[payment] Revenue recording failed (non-fatal):", revErr.message);
  }

  // ── Notifications ──
  const [student, admins] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true } }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
  ]);

  await notify({
    userId,
    title:   "✅ Payment Successful — You're Enrolled!",
    message: `Your payment was confirmed. You're now enrolled in "${course.title}". Start learning anytime!`,
    type:    "PAYMENT",
  });

  await notify({
    userId:  course.instructorId,
    title:   "💰 New Paid Enrollment",
    message: `${student?.fullName || "A student"} just enrolled in "${course.title}".`,
    type:    "ENROLLMENT",
  });

  for (const admin of admins) {
    await notify({
      userId:  admin.id,
      title:   "💳 New Course Purchase",
      message: `${student?.fullName || "A student"} purchased "${course.title}" for $${course.price}.`,
      type:    "PAYMENT",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/initialize
// Body: { courseId, couponCode?, referral? }
// ─────────────────────────────────────────────────────────────────────────────
exports.initializePayment = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ message: "Payment not configured — PAYSTACK_SECRET_KEY is missing" });
    }

    const userId   = req.user.id;
    const { courseId, couponCode, referral } = req.body;

    if (!courseId) return res.status(400).json({ message: "courseId is required" });

    const [user, course] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.course.findUnique({ where: { id: courseId } }),
    ]);

    if (!course)                        return res.status(404).json({ message: "Course not found" });
    if (course.status !== "PUBLISHED")  return res.status(400).json({ message: "Course is not published" });
    if (!course.price || course.price === 0) return res.status(400).json({ message: "Course is free — use /enroll/free" });

    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (enrolled) return res.status(400).json({ message: "Already enrolled" });

    // ── Revenue split (only if revenueService available) ─────────────────
    let finalPrice  = course.price;
    let saleSource  = "PLATFORM";
    let split       = { platformFeeRate: 0.63, platformFee: course.price * 0.63, instructorEarning: course.price * 0.37 };

    if (revenueService) {
      const couponResult = await revenueService.validateCoupon(couponCode, courseId);
      saleSource = referral ? "INSTRUCTOR" : couponResult.saleSource;

      if (couponResult.valid && couponResult.discountPct > 0) {
        finalPrice = parseFloat((course.price * (1 - couponResult.discountPct / 100)).toFixed(2));
      }
      split = revenueService.calculateSplit(finalPrice, saleSource);

      // Increment coupon usage optimistically
      if (couponResult.valid && couponResult.coupon) {
        prisma.coupon.update({
          where: { id: couponResult.coupon.id },
          data:  { usageCount: { increment: 1 } },
        }).catch(console.error);
      }
    }

    // ── Create a pending Payment row if table exists ──────────────────────
    let pendingPaymentId = null;
    if (revenueService) {
      try {
        const availableAfter = new Date();
        availableAfter.setDate(availableAfter.getDate() + (revenueService.HOLD_DAYS || 30));

        const tempRef = `PENDING_${userId}_${Date.now()}`;
        const pending = await prisma.payment.create({
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
            couponCode:        couponCode?.toUpperCase() || null,
          },
        });
        pendingPaymentId = pending.id;
      } catch (dbErr) {
        // Payment table might not exist yet (migration pending) — continue anyway
        console.warn("[payment] Could not create pending Payment row (migration pending?):", dbErr.message);
      }
    }

    // ── Call Paystack ─────────────────────────────────────────────────────
    const callbackUrl = `${process.env.PAYSTACK_CALLBACK_URL}?courseId=${courseId}`;
    const body = JSON.stringify({
      email:        user.email,
      amount:       Math.round(finalPrice * 100), // kobo
      currency:     "NGN",
      callback_url: callbackUrl,
      metadata: {
        userId,
        courseId,
        courseTitle: course.title,
        saleSource,
        amount:      Math.round(finalPrice * 100),
        ...(pendingPaymentId && { paymentId: pendingPaymentId }),
      },
    });

    const response = await paystackRequest(
      {
        hostname: "api.paystack.co",
        port:     443,
        path:     "/transaction/initialize",
        method:   "POST",
        headers:  {
          Authorization:  `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      body
    );

    if (!response.status) {
      // Clean up the pending row
      if (pendingPaymentId) {
        prisma.payment.delete({ where: { id: pendingPaymentId } }).catch(() => {});
      }
      return res.status(400).json({ message: response.message || "Paystack initialization failed" });
    }

    // Update the pending row with the real Paystack reference
    if (pendingPaymentId) {
      prisma.payment.update({
        where: { id: pendingPaymentId },
        data:  { reference: response.data.reference },
      }).catch(console.error);
    }

    return res.status(200).json({
      authorizationUrl: response.data.authorization_url,
      reference:        response.data.reference,
      amount:           finalPrice,
      originalPrice:    course.price,
      discount:         parseFloat((course.price - finalPrice).toFixed(2)),
    });

  } catch (err) {
    console.error("[initializePayment] error:", err);
    res.status(500).json({ message: "Failed to initialize payment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/verify/:reference
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    if (!PAYSTACK_SECRET) {
      return res.status(500).json({ message: "Payment not configured" });
    }

    const { reference } = req.params;

    const response = await paystackRequest({
      hostname: "api.paystack.co",
      port:     443,
      path:     `/transaction/verify/${encodeURIComponent(reference)}`,
      method:   "GET",
      headers:  { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    if (response.status && response.data.status === "success") {
      const { userId, courseId, saleSource, amount } = response.data.metadata || {};

      if (userId && courseId) {
        await completeEnrollment(userId, courseId, reference, { saleSource, amount });
      }

      return res.status(200).json({ message: "Payment verified", success: true, courseId });
    } else {
      // Mark failed if row exists
      prisma.payment.updateMany({
        where: { reference, status: "PENDING" },
        data:  { status: "FAILED" },
      }).catch(() => {});

      return res.status(400).json({ message: "Payment not successful", success: false });
    }
  } catch (err) {
    console.error("[verifyPayment] error:", err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/webhook  (Paystack → your server)
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
      const { userId, courseId, saleSource, amount } = data.metadata || {};
      if (userId && courseId) {
        await completeEnrollment(userId, courseId, data.reference, { saleSource, amount });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[webhook] error:", err);
    res.status(500).json({ message: "Webhook error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/enroll/free
// Body: { courseId }
// ─────────────────────────────────────────────────────────────────────────────
exports.freeEnroll = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId) return res.status(400).json({ message: "courseId is required" });

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course)                       return res.status(404).json({ message: "Course not found" });
    if (course.price > 0)              return res.status(400).json({ message: "Course is not free" });
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
      message: `You're now enrolled in "${course.title}". Start learning now!`,
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
    console.error("[freeEnroll] error:", err);
    res.status(500).json({ message: "Failed to enroll" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/payments/admin/refund/:paymentId  (Admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.processRefund = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });
    if (!revenueService)           return res.status(400).json({ message: "Payment system not enabled" });

    const { paymentId } = req.params;
    const reason        = req.body.reason || "Admin-issued refund";

    const result = await revenueService.handleRefund(paymentId, reason);

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (payment) {
      await prisma.enrollment.deleteMany({
        where: { userId: payment.userId, courseId: payment.courseId },
      });
    }

    res.status(200).json({ message: "Refund processed successfully", ...result });
  } catch (err) {
    console.error("[processRefund] error:", err);
    res.status(400).json({ message: err.message || "Failed to process refund" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/history  (Student)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
  try {
    // If Payment table doesn't exist yet, return empty array gracefully
    const payments = await prisma.payment.findMany({
      where:   { userId: req.user.id },
      include: { course: { select: { id: true, title: true, thumbnail: true } } },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);

    res.status(200).json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/admin/all  (Admin)
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
    }).catch(() => []);

    res.status(200).json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};