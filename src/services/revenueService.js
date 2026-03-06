// src/services/revenueService.js
//
// All revenue / wallet business logic lives here.
// Controllers and the cron job are thin wrappers around these functions.
//
const prisma     = require("../prisma");
const { notify } = require("../utils/notificationHelper");

// ── Revenue split rates ───────────────────────────────────────────────────────
// PLATFORM   = student found the course via search/browse
// INSTRUCTOR = student used the instructor's referral link or coupon
const RATES = {
  PLATFORM:   { instructorShare: 0.37, platformShare: 0.63 },
  INSTRUCTOR: { instructorShare: 0.97, platformShare: 0.03 },
};

const HOLD_DAYS  = 30;   // days before earnings move to availableBalance
const MIN_PAYOUT = 25;   // minimum availableBalance required to request a payout

// ─────────────────────────────────────────────────────────────────────────────
// calculateSplit
// Pure function — takes the course price and sale source, returns the split.
// ─────────────────────────────────────────────────────────────────────────────
const calculateSplit = (amount, saleSource = "PLATFORM") => {
  const { instructorShare, platformShare } = RATES[saleSource] || RATES.PLATFORM;
  return {
    saleSource,
    platformFeeRate:   platformShare,
    platformFee:       parseFloat((amount * platformShare).toFixed(2)),
    instructorEarning: parseFloat((amount * instructorShare).toFixed(2)),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// getOrCreateWallet
// Idempotent — creates on first sale, returns existing on all subsequent calls.
// ─────────────────────────────────────────────────────────────────────────────
const getOrCreateWallet = (instructorId) =>
  prisma.instructorWallet.upsert({
    where:  { instructorId },
    create: { instructorId },
    update: {},
  });

// ─────────────────────────────────────────────────────────────────────────────
// recordEarning
// Called immediately after a successful Paystack confirmation.
// Creates the ledger row and increments pendingBalance + totalEarned.
// ─────────────────────────────────────────────────────────────────────────────
const recordEarning = async ({ paymentId, instructorId, amount, saleSource, availableAfter }) => {
  const wallet = await getOrCreateWallet(instructorId);

  await prisma.$transaction([
    // Ledger entry
    prisma.instructorEarning.create({
      data: { walletId: wallet.id, paymentId, amount, saleSource, availableAfter },
    }),
    // Wallet counters
    prisma.instructorWallet.update({
      where: { id: wallet.id },
      data: {
        pendingBalance: { increment: amount },
        totalEarned:    { increment: amount },
      },
    }),
  ]);

  // Notify instructor
  await notify({
    userId:  instructorId,
    title:   "💰 New Sale!",
    message: `You earned $${amount.toFixed(2)} from a new enrollment. It will be available in your balance after ${HOLD_DAYS} days.`,
    type:    "PAYMENT_RECEIVED",
  });

  return wallet;
};

// ─────────────────────────────────────────────────────────────────────────────
// releaseMaturedEarnings
// Run by a cron job (e.g. every hour via node-cron).
// Finds all unreleased earnings whose hold period has elapsed and moves
// them from pendingBalance → availableBalance.
// ─────────────────────────────────────────────────────────────────────────────
const releaseMaturedEarnings = async () => {
  const now = new Date();

  const matured = await prisma.instructorEarning.findMany({
    where: {
      isReleased:    false,
      availableAfter: { lte: now },
    },
    include: {
      wallet:  true,
      payment: { select: { status: true } },
    },
  });

  if (matured.length === 0) return { released: 0 };

  let released = 0;

  for (const earning of matured) {
    // If the underlying payment was refunded, just mark as released
    // (the refund handler already reversed the wallet balance)
    if (earning.payment?.status === "REFUNDED") {
      await prisma.instructorEarning.update({
        where: { id: earning.id },
        data:  { isReleased: true, releasedAt: now },
      });
      continue;
    }

    // Move pending → available atomically
    await prisma.$transaction([
      prisma.instructorEarning.update({
        where: { id: earning.id },
        data:  { isReleased: true, releasedAt: now },
      }),
      prisma.payment.update({
        where: { id: earning.paymentId },
        data:  { releasedAt: now },
      }),
      prisma.instructorWallet.update({
        where: { id: earning.walletId },
        data: {
          pendingBalance:   { decrement: earning.amount },
          availableBalance: { increment: earning.amount },
        },
      }),
    ]);

    await notify({
      userId:  earning.wallet.instructorId,
      title:   "✅ Earnings Available!",
      message: `$${earning.amount.toFixed(2)} from a sale 30 days ago has cleared and is now in your available balance. You can request a payout anytime.`,
      type:    "PAYMENT_RECEIVED",
    });

    released++;
  }

  console.log(`[revenueService] Released ${released} earning(s) to available balance.`);
  return { released };
};

// ─────────────────────────────────────────────────────────────────────────────
// handleRefund
// Reverses the instructor's earning.
// If still in pendingBalance  → deducts from pendingBalance.
// If already in availableBalance → deducts from availableBalance.
// totalEarned is also corrected so lifetime stats stay accurate.
// ─────────────────────────────────────────────────────────────────────────────
const handleRefund = async (paymentId, reason = "Refund requested") => {
  const payment = await prisma.payment.findUnique({
    where:   { id: paymentId },
    include: { earningRecord: { include: { wallet: true } } },
  });

  if (!payment)                          throw new Error("Payment not found");
  if (payment.status === "REFUNDED")     throw new Error("Payment already refunded");
  if (payment.status !== "COMPLETED")    throw new Error("Only completed payments can be refunded");

  const earning = payment.earningRecord;
  const now     = new Date();

  // Mark payment as refunded
  await prisma.payment.update({
    where: { id: paymentId },
    data:  { status: "REFUNDED", refundedAt: now, refundReason: reason },
  });

  if (earning) {
    const { wallet, amount, isReleased } = earning;

    await prisma.$transaction([
      // Mark ledger row as released so the cron job skips it
      prisma.instructorEarning.update({
        where: { id: earning.id },
        data:  { isReleased: true, releasedAt: now },
      }),
      // Reverse from the correct balance bucket
      prisma.instructorWallet.update({
        where: { id: wallet.id },
        data: isReleased
          ? { availableBalance: { decrement: amount }, totalEarned: { decrement: amount } }
          : { pendingBalance:   { decrement: amount }, totalEarned: { decrement: amount } },
      }),
    ]);

    await notify({
      userId:  wallet.instructorId,
      title:   "⚠️ Sale Refunded",
      message: `A student was refunded for a course purchase. $${amount.toFixed(2)} has been deducted from your ${isReleased ? "available" : "pending"} balance. Reason: ${reason}`,
      type:    "REFUND",
    });
  }

  return { refunded: true, amount: payment.amount };
};

// ─────────────────────────────────────────────────────────────────────────────
// validateCoupon
// Returns { valid, saleSource, discountPct, coupon }.
// A valid coupon must belong to the course's instructor.
// ─────────────────────────────────────────────────────────────────────────────
const validateCoupon = async (code, courseId) => {
  const empty = { valid: false, saleSource: "PLATFORM", discountPct: 0, coupon: null };
  if (!code) return empty;

  const coupon = await prisma.coupon.findUnique({
    where:   { code: code.toUpperCase().trim() },
    include: { instructor: { select: { courses: { select: { id: true } } } } },
  });

  if (!coupon || !coupon.isActive)                                      return empty;
  if (coupon.expiresAt && coupon.expiresAt < new Date())                return empty;
  if (coupon.maxUsage !== null && coupon.usageCount >= coupon.maxUsage) return empty;

  // Coupon must be created by the instructor who owns this course
  const ownsThisCourse = coupon.instructor.courses.some((c) => c.id === courseId);
  if (!ownsThisCourse) return empty;

  return { valid: true, saleSource: "INSTRUCTOR", discountPct: coupon.discountPct, coupon };
};

module.exports = {
  HOLD_DAYS,
  MIN_PAYOUT,
  RATES,
  calculateSplit,
  getOrCreateWallet,
  recordEarning,
  releaseMaturedEarnings,
  handleRefund,
  validateCoupon,
};
