const prisma = require("../prisma");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail");
const verificationEmail = require("../emails/verificationEmail"); // import the email template


// ===================== REGISTER =====================
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, role, avatarUrl } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        role: role || "STUDENT",
        avatarUrl,
        emailVerificationToken: verificationToken,
        emailVerifyExpires: verificationExpires,
      },
    });

    const verifyLink = `${process.env.BACKEND_URL}/api/auth/verify-email/${verificationToken}`;

    // Use the fancy email template
    await sendEmail(
      email,
      "Verify Your Email",
      verificationEmail(fullName, verifyLink)
    );

    return res.status(201).json({
      message: "Registration successful. Check your email to verify.",
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Registration failed" });
  }
};


// ===================== VERIFY EMAIL =====================
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerifyExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/verify-email?status=error`
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerifyExpires: null,
      },
    });

    return res.redirect(
      `${process.env.FRONTEND_URL}/verify-email?status=success`
    );
  } catch (error) {
    console.error("Verify email error:", error);
    return res.redirect(
      `${process.env.FRONTEND_URL}/verify-email?status=error`
    );
  }
};


// ===================== LOGIN =====================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isEmailVerified) {
      return res.status(401).json({ message: "Email not verified" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Login failed" });
  }
};
