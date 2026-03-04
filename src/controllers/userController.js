const prisma = require("../prisma");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
// const { sendResetEmail } = require("../utils/email"); // optional: you can implement this

// ===================== UPDATE PROFILE =====================
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      fullName,
      avatarUrl,
      bio,
      phone,
      learningGoal,
      level,
      expertise,
      yearsExperience,
    } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        avatarUrl,
        bio,
        phone,
        learningGoal,
        level,
        expertise,
        yearsExperience,
      },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
        phone: updatedUser.phone,
        learningGoal: updatedUser.learningGoal,
        level: updatedUser.level,
        expertise: updatedUser.expertise,
        yearsExperience: updatedUser.yearsExperience,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// ===================== CHANGE PASSWORD =====================
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both passwords are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { password: hashed },
    });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to change password" });
  }
};

// ===================== FORGOT PASSWORD =====================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.status(400).json({ message: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user)
      return res
        .status(404)
        .json({ message: "No user found with this email" });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHashed = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Save hashed token + expiry in DB
    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: resetTokenHashed,
        resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send email (optional: implement sendResetEmail)
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    // await sendResetEmail(email, resetURL);

    res.status(200).json({
      message: "Password reset email sent",
      resetURL, // for testing only; remove in production
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send reset email" });
  }
};

// ===================== RESET PASSWORD =====================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8)
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });

    const resetTokenHashed = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: resetTokenHashed,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    res.status(200).json({
      message: "Password reset successful. Please log in with your new password.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reset password" });
  }
};
// ===================== GET PROFILE =====================
exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: {
        id: true, email: true, fullName: true, bio: true,
        avatarUrl: true, phone: true, role: true, status: true,
        expertise: true, yearsExperience: true,
        learningGoal: true, level: true,
        isEmailVerified: true, createdAt: true,
        _count: { select: { enrollments: true, courses: true } },
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin only" });
    }
    const users = await prisma.user.findMany({
      select: {
        id: true, fullName: true, email: true, role: true,
        isEmailVerified: true, createdAt: true, avatarUrl: true, status: true,
        _count: { select: { enrollments: true, courses: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};
