// src/controllers/paymentController.js
const prisma     = require("../prisma");
const https      = require("https");
const { notify } = require("../utils/notificationHelper");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ── Helper to create enrollment + fire all notifications ──────────
const completeEnrollment = async (userId, courseId) => {
  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return; // already enrolled, idempotent

  await prisma.enrollment.create({ data: { userId, courseId } });

  const [course, student, admins] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, include: { instructor: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } }),
    prisma.user.findMany({ where: { role: "ADMIN" } }),
  ]);

  // ── Student: payment confirmed + enrolled ────────────────────────
  await notify({
    userId,
    title:   "✅ Payment Successful — Enrolled!",
    message: `Your payment was confirmed and you're now enrolled in "${course?.title}". Start learning anytime!`,
    type:    "PAYMENT",
  });

  // ── Instructor: new paid student ─────────────────────────────────
  if (course?.instructorId) {
    await notify({
      userId:  course.instructorId,
      title:   "💰 New Paid Enrollment",
      message: `${student?.fullName || "A student"} just paid and enrolled in your course "${course?.title}". You earned $${course?.price}!`,
      type:    "ENROLLMENT",
    });
  }

  // ── Admins: revenue alert ─────────────────────────────────────────
  for (const admin of admins) {
    await notify({
      userId:  admin.id,
      title:   "💳 New Course Purchase",
      message: `${student?.fullName || "A student"} purchased "${course?.title}" for $${course?.price}.`,
      type:    "PAYMENT",
    });
  }
};

// ===================== INITIALIZE PAYMENT =====================
exports.initializePayment = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { courseId } = req.body;

    const user   = await prisma.user.findUnique({ where: { id: userId } });
    const course = await prisma.course.findUnique({ where: { id: courseId } });

    if (!course)          return res.status(404).json({ message: "Course not found" });
    if (course.price === 0) return res.status(400).json({ message: "Course is free — use free enroll" });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return res.status(400).json({ message: "Already enrolled" });

    const amountInKobo = Math.round(course.price * 100);
    const callbackUrl  = `${process.env.PAYSTACK_CALLBACK_URL}?courseId=${courseId}`;

    const params = JSON.stringify({
      email:        user.email,
      amount:       amountInKobo,
      currency:     "NGN",
      callback_url: callbackUrl,
      metadata:     { userId, courseId, courseTitle: course.title },
    });

    const options = {
      hostname: "api.paystack.co",
      port:     443,
      path:     "/transaction/initialize",
      method:   "POST",
      headers:  {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = "";
      paystackRes.on("data",  (chunk) => { data += chunk; });
      paystackRes.on("end",   () => {
        const response = JSON.parse(data);
        if (response.status) {
          res.status(200).json({
            authorizationUrl: response.data.authorization_url,
            reference:        response.data.reference,
          });
        } else {
          res.status(400).json({ message: response.message });
        }
      });
    });

    paystackReq.on("error", (err) => {
      console.error(err);
      res.status(500).json({ message: "Payment initialization failed" });
    });
    paystackReq.write(params);
    paystackReq.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to initialize payment" });
  }
};

// ===================== VERIFY PAYMENT =====================
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
      paystackRes.on("data",  (chunk) => { data += chunk; });
      paystackRes.on("end",   async () => {
        const response = JSON.parse(data);

        if (response.status && response.data.status === "success") {
          const { userId, courseId } = response.data.metadata;
          await completeEnrollment(userId, courseId);
          res.status(200).json({ message: "Payment verified", success: true, courseId });
        } else {
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

// ===================== PAYSTACK WEBHOOK =====================
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
        await completeEnrollment(userId, courseId);
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Webhook error" });
  }
};
