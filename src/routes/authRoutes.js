const express = require("express");
const router  = express.Router();

const {
  register,
  login,
  verifyEmail,
  resendVerification,
} = require("../controllers/authController");

// ── Public routes ─────────────────────────────────────────────────────────────
router.post("/register",             register);
router.post("/login",                login);
router.get( "/verify-email/:token",  verifyEmail);
router.post("/resend-verification",  resendVerification);

module.exports = router;