const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const { initializePayment, verifyPayment, webhook } = require("../controllers/paymentController");

router.post("/initialize", protect, initializePayment);
router.get("/verify/:reference", protect, verifyPayment);
router.post("/webhook", webhook); // no auth — Paystack calls this directly

module.exports = router;