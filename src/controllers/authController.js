const prisma  = require("../prisma");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const sendEmail        = require("../utils/sendEmail");
const verificationEmail = require("../emails/verificationEmail");


// ── helper: never reveal whether an email exists ─────────────────────────────
const GENERIC_RESEND_MSG = "If that email exists and is unverified, we sent a new link.";


// ===================== REGISTER =====================
exports.register = async (req, res) => {
  try {
    const { email, password, fullName, role, avatarUrl } = req.body;

    // ── validation ──────────────────────────────────────────────────────────
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (fullName.trim().length < 2) {
      return res.status(400).json({ message: "Full name must be at least 2 characters" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    const allowedRoles = ["STUDENT", "INSTRUCTOR"];
    const userRole = allowedRoles.includes(role) ? role : "STUDENT";

    // ── uniqueness check ─────────────────────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // ── create user ──────────────────────────────────────────────────────────
    const hashedPassword      = await bcrypt.hash(password, 12);
    const verificationToken   = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    await prisma.user.create({
      data: {
        email:                  email.trim().toLowerCase(),
        password:               hashedPassword,
        fullName:               fullName.trim(),
        role:                   userRole,
        avatarUrl:              avatarUrl || null,
        emailVerificationToken: verificationToken,
        emailVerifyExpires:     verificationExpires,
      },
    });

    // ── send verification email (non-blocking — user is already saved) ────────
    // If email fails we still return success. The user can resend from the
    // "resend-verification" endpoint. This prevents a nodemailer timeout from
    // blocking registration.
    const verifyLink = `${process.env.BACKEND_URL}/api/auth/verify-email/${verificationToken}`;
    try {
      await sendEmail(email, "Verify Your Email", verificationEmail(fullName.trim(), verifyLink));
    } catch (emailErr) {
      // Log for ops visibility but DO NOT fail the request
      console.error("REGISTER — verification email failed to send:", emailErr.message);
    }

    return res.status(201).json({
      message: "Registration successful. Check your email to verify your account.",
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
        emailVerifyExpires:     { gt: new Date() },
      },
    });

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/verify-email?status=error`);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified:        true,
        emailVerificationToken: null,
        emailVerifyExpires:     null,
      },
    });

    return res.redirect(`${process.env.FRONTEND_URL}/verify-email?status=success`);
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    return res.redirect(`${process.env.FRONTEND_URL}/verify-email?status=error`);
  }
};


// ===================== RESEND VERIFICATION EMAIL =====================
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Always return 200 — never reveal whether the email exists (security)
    if (!user || user.isEmailVerified) {
      return res.status(200).json({ message: GENERIC_RESEND_MSG });
    }

    const verificationToken   = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        emailVerificationToken: verificationToken,
        emailVerifyExpires:     verificationExpires,
      },
    });

    const verifyLink = `${process.env.BACKEND_URL}/api/auth/verify-email/${verificationToken}`;
    try {
      await sendEmail(email, "Verify Your Email", verificationEmail(user.fullName, verifyLink));
    } catch (emailErr) {
      console.error("RESEND VERIFICATION — email send failed:", emailErr.message);
      // Still return success — token is saved, user can try again
    }

    return res.status(200).json({ message: GENERIC_RESEND_MSG });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    return res.status(500).json({ message: "Failed to resend verification email" });
  }
};


// ===================== LOGIN =====================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    // Use identical wording for "user not found" and "wrong password"
    // so attackers cannot enumerate registered emails
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

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id:       user.id,
        email:    user.email,
        fullName: user.fullName,
        role:     user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};