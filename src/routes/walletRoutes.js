const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  getMyWallet,
  getEarnings,
  requestPayout,
  getMyPayoutRequests,
  getAllPayoutRequests,
  getAllWallets,
  approvePayout,
  rejectPayout,
} = require("../controllers/walletController");
//
// ── Instructor ────────────────────────────────────────────────
router.get("/me",                   protect, getMyWallet);
router.get("/me/earnings",          protect, getEarnings);
router.post("/payout/request",      protect, requestPayout);
router.get( "/payout/requests",     protect, getMyPayoutRequests);
//
// ── Admin ─────────────────────────────────────────────────────
router.get(   "/admin/payouts",          protect, getAllPayoutRequests);
router.get(   "/admin/instructors",      protect, getAllWallets);
router.patch( "/admin/payouts/:id/approve", protect, approvePayout);
router.patch( "/admin/payouts/:id/reject",  protect, rejectPayout);

module.exports = router;