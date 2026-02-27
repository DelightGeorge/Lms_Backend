const prisma = require("../prisma");
const https = require("https");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// ===================== INITIALIZE PAYMENT =====================
exports.initializePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const course = await prisma.course.findUnique({ where: { id: courseId } });

    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.price === 0) return res.status(400).json({ message: "Course is free" });

    // Check already enrolled
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return res.status(400).json({ message: "Already enrolled" });

    const amountInKobo = Math.round(course.price * 100);
    const callbackUrl = `${process.env.PAYSTACK_CALLBACK_URL}?courseId=${courseId}`;

    const params = JSON.stringify({
      email: user.email,
      amount: amountInKobo,
      currency: "NGN",
      callback_url: callbackUrl,
      metadata: {
        userId,
        courseId,
        courseTitle: course.title,
      },
    });

    const options = {
      hostname: "api.paystack.co",
      port: 443,
      path: "/transaction/initialize",
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = "";
      paystackRes.on("data", (chunk) => { data += chunk; });
      paystackRes.on("end", () => {
        const response = JSON.parse(data);
        if (response.status) {
          res.status(200).json({
            authorizationUrl: response.data.authorization_url,
            reference: response.data.reference,
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
      port: 443,
      path: `/transaction/verify/${reference}`,
      method: "GET",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
      },
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = "";
      paystackRes.on("data", (chunk) => { data += chunk; });
      paystackRes.on("end", async () => {
        const response = JSON.parse(data);

        if (response.status && response.data.status === "success") {
          const { userId, courseId } = response.data.metadata;

          // Check not already enrolled
          const existing = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
          });

          if (!existing) {
            await prisma.enrollment.create({ data: { userId, courseId } });

            const course = await prisma.course.findUnique({ where: { id: courseId } });
            await prisma.notification.create({
              data: {
                title: "Payment Successful",
                message: `You are now enrolled in "${course?.title}"`,
                type: "ENROLLMENT",
                userId,
              },
            });
          }

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
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    const { event, data } = req.body;

    if (event === "charge.success") {
      const { userId, courseId } = data.metadata;
      if (userId && courseId) {
        const existing = await prisma.enrollment.findUnique({
          where: { userId_courseId: { userId, courseId } },
        });
        if (!existing) {
          await prisma.enrollment.create({ data: { userId, courseId } });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Webhook error" });
  }
};