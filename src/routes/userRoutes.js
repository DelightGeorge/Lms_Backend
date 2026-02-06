const express = require("express");
const router = express.Router();
const {
  changePassword,
  forgotPassword,
  updateProfile,
  resetPassword,

} = require("../controllers/userController");
const protect = require("../middlewares/auth");

router.patch("/me", protect, updateProfile);
router.patch("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.patch("/reset-password/:token", resetPassword);

module.exports = router;
