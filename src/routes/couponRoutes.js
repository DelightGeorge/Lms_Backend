// src/routes/couponRoutes.js
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  createCoupon,
  getMyCoupons,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} = require("../controllers/couponController");

// ── Public (student validates at checkout) ───────────────────
router.get("/validate", validateCoupon);                  // GET /api/coupons/validate?code=X&courseId=Y

// ── Instructor ────────────────────────────────────────────────
router.get( "/mine",    protect, getMyCoupons);           // own coupons
router.post("/",        protect, createCoupon);           // create
router.patch("/:id",    protect, updateCoupon);           // toggle active / update
router.delete("/:id",   protect, deleteCoupon);           // delete

module.exports = router;
