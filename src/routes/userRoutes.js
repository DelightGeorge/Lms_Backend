// src/routes/userRoutes.js
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getAllUsers,
} = require("../controllers/userController");

router.get("/me",                      protect, getProfile);     // GET   /api/users/me
router.patch("/me",                    protect, updateProfile);  // PATCH /api/users/me
router.patch("/change-password",       protect, changePassword); // PATCH /api/users/change-password
router.post("/forgot-password",        forgotPassword);          // POST  /api/users/forgot-password
router.patch("/reset-password/:token", resetPassword);           // PATCH /api/users/reset-password/:token
router.get("/",                        protect, getAllUsers);     // GET   /api/users (admin)

module.exports = router;
