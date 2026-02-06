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
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.status(200).json({
      message: "Password changed successfully. Please log in again.",
    });
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
