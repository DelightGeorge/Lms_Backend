// ============================================================
// src/routes/paymentRoutes.js
// ============================================================
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  initializePayment,
  verifyPayment,
  webhook,
  freeEnroll,
  processRefund,
  getPaymentHistory,
  getAllPayments,
} = require("../controllers/paymentController");

// ── Paystack webhook (no auth — verified by HMAC signature) ──
router.post("/webhook", webhook);

// ── Student ───────────────────────────────────────────────────
router.post("/initialize",   protect, initializePayment);  // init Paystack tx
router.get( "/verify/:reference", protect, verifyPayment); // confirm after redirect
router.post("/enroll/free",  protect, freeEnroll);         // free courses
router.get( "/history",      protect, getPaymentHistory);  // own payment history

// ── Admin ─────────────────────────────────────────────────────
router.get(  "/admin/all",          protect, getAllPayments);           // all payments
router.post( "/admin/refund/:paymentId", protect, processRefund);      // issue refund

module.exports = router;


// ============================================================
// src/routes/walletRoutes.js
// ============================================================
// const express = require("express");
// const router  = express.Router();
// const protect = require("../middlewares/auth");
// const {
//   getMyWallet,
//   getEarnings,
//   requestPayout,
//   getMyPayoutRequests,
//   getAllPayoutRequests,
//   getAllWallets,
//   approvePayout,
//   rejectPayout,
// } = require("../controllers/walletController");
//
// // ── Instructor ────────────────────────────────────────────────
// router.get("/me",                   protect, getMyWallet);
// router.get("/me/earnings",          protect, getEarnings);
// router.post("/payout/request",      protect, requestPayout);
// router.get( "/payout/requests",     protect, getMyPayoutRequests);
//
// // ── Admin ─────────────────────────────────────────────────────
// router.get(   "/admin/payouts",          protect, getAllPayoutRequests);
// router.get(   "/admin/instructors",      protect, getAllWallets);
// router.patch( "/admin/payouts/:id/approve", protect, approvePayout);
// router.patch( "/admin/payouts/:id/reject",  protect, rejectPayout);
//
// module.exports = router;
