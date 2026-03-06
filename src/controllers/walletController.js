// src/controllers/walletController.js
//
// Instructor wallet endpoints + payout request management.
// Admin payout approval lives here too.
//
const prisma         = require("../prisma");
const { notify }     = require("../utils/notificationHelper");
const revenueService = require("../services/revenueService");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/me   (Instructor)
// Returns the wallet summary + recent earnings + pending payout requests.
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyWallet = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    // getOrCreateWallet so instructors always see a wallet even before first sale
    const wallet = await revenueService.getOrCreateWallet(req.user.id);

    // Recent earnings (last 20)
    const earnings = await prisma.instructorEarning.findMany({
      where:   { walletId: wallet.id },
      include: {
        payment: {
          include: { course: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take:    20,
    });

    // Active payout requests
    const payoutRequests = await prisma.payoutRequest.findMany({
      where:   { instructorId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    10,
    });

    res.status(200).json({
      wallet: {
        pendingBalance:   wallet.pendingBalance,
        availableBalance: wallet.availableBalance,
        totalEarned:      wallet.totalEarned,
        totalPaidOut:     wallet.totalPaidOut,
        canRequestPayout: wallet.availableBalance >= revenueService.MIN_PAYOUT,
        minPayout:        revenueService.MIN_PAYOUT,
      },
      earnings,
      payoutRequests,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch wallet" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/me/earnings   (Instructor — paginated earnings ledger)
// Query params: ?page=1&limit=20&released=true|false
// ─────────────────────────────────────────────────────────────────────────────
exports.getEarnings = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const page     = Math.max(parseInt(req.query.page  || "1"),  1);
    const limit    = Math.min(parseInt(req.query.limit || "20"), 50);
    const skip     = (page - 1) * limit;
    const released = req.query.released === "true"
      ? true
      : req.query.released === "false"
        ? false
        : undefined;

    const wallet = await revenueService.getOrCreateWallet(req.user.id);

    const where = {
      walletId:   wallet.id,
      ...(released !== undefined && { isReleased: released }),
    };

    const [earnings, total] = await Promise.all([
      prisma.instructorEarning.findMany({
        where,
        include: { payment: { include: { course: { select: { id: true, title: true } } } } },
        orderBy: { createdAt: "desc" },
        skip,
        take:    limit,
      }),
      prisma.instructorEarning.count({ where }),
    ]);

    res.status(200).json({
      earnings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch earnings" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/wallet/payout/request   (Instructor)
// Body: { amount, payoutMethod, accountName, accountNumber, bankName, paypalEmail? }
// ─────────────────────────────────────────────────────────────────────────────
exports.requestPayout = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const {
      amount,
      payoutMethod  = "bank_transfer",
      accountName,
      accountNumber,
      bankName,
      paypalEmail,
    } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid payout amount" });
    }

    const wallet = await revenueService.getOrCreateWallet(req.user.id);

    if (wallet.availableBalance < revenueService.MIN_PAYOUT) {
      return res.status(400).json({
        message: `Minimum payout is $${revenueService.MIN_PAYOUT}. Your available balance is $${wallet.availableBalance.toFixed(2)}.`,
      });
    }

    if (amount > wallet.availableBalance) {
      return res.status(400).json({
        message: `Requested amount ($${amount}) exceeds your available balance ($${wallet.availableBalance.toFixed(2)}).`,
      });
    }

    // Check no pending payout already exists
    const pending = await prisma.payoutRequest.findFirst({
      where: { instructorId: req.user.id, status: "PENDING" },
    });
    if (pending) {
      return res.status(400).json({ message: "You already have a pending payout request. Wait for it to be processed." });
    }

    // Deduct from availableBalance immediately (held until admin approves/rejects)
    const [payoutRequest] = await prisma.$transaction([
      prisma.payoutRequest.create({
        data: {
          walletId:     wallet.id,
          instructorId: req.user.id,
          amount:       parseFloat(amount),
          payoutMethod,
          accountName,
          accountNumber,
          bankName,
          paypalEmail,
          status: "PENDING",
        },
      }),
      prisma.instructorWallet.update({
        where: { id: wallet.id },
        data:  { availableBalance: { decrement: parseFloat(amount) } },
      }),
    ]);

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const admin of admins) {
      await notify({
        userId:  admin.id,
        title:   "💸 New Payout Request",
        message: `Instructor ${req.user.fullName || req.user.email} has requested a payout of $${parseFloat(amount).toFixed(2)}.`,
        type:    "PAYOUT_REQUESTED",
      });
    }

    res.status(201).json({
      message:       "Payout request submitted. An admin will process it shortly.",
      payoutRequest,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit payout request" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/payout/requests   (Instructor — own requests)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyPayoutRequests = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const requests = await prisma.payoutRequest.findMany({
      where:   { instructorId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payout requests" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/admin/payouts   (Admin — all pending/all requests)
// Query: ?status=PENDING|APPROVED|REJECTED|PAID
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllPayoutRequests = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const { status } = req.query;
    const requests = await prisma.payoutRequest.findMany({
      where:   status ? { status } : {},
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        wallet:     { select: { availableBalance: true, totalEarned: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch payout requests" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/wallet/admin/payouts/:id/approve   (Admin)
// Body: { adminNote? }
// Marks the payout APPROVED (funds sent), updates totalPaidOut.
// ─────────────────────────────────────────────────────────────────────────────
exports.approvePayout = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const payout = await prisma.payoutRequest.findUnique({
      where:   { id: req.params.id },
      include: { wallet: true },
    });

    if (!payout)                    return res.status(404).json({ message: "Payout request not found" });
    if (payout.status !== "PENDING") return res.status(400).json({ message: `Payout is already ${payout.status}` });

    // Mark approved + increment totalPaidOut
    // (availableBalance was already decremented when the request was submitted)
    const [updated] = await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status:         "APPROVED",
          processedById:  req.user.id,
          processedAt:    new Date(),
          adminNote:      req.body.adminNote || null,
        },
      }),
      prisma.instructorWallet.update({
        where: { id: payout.walletId },
        data:  { totalPaidOut: { increment: payout.amount } },
      }),
    ]);

    await notify({
      userId:  payout.instructorId,
      title:   "✅ Payout Approved!",
      message: `Your payout request of $${payout.amount.toFixed(2)} has been approved and is being processed. ${req.body.adminNote ? `Note: ${req.body.adminNote}` : ""}`,
      type:    "PAYOUT_APPROVED",
    });

    res.status(200).json({ message: "Payout approved", payout: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve payout" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/wallet/admin/payouts/:id/reject   (Admin)
// Body: { rejectionReason? }
// Refunds the held amount back to availableBalance.
// ─────────────────────────────────────────────────────────────────────────────
exports.rejectPayout = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const payout = await prisma.payoutRequest.findUnique({
      where:   { id: req.params.id },
      include: { wallet: true },
    });

    if (!payout)                    return res.status(404).json({ message: "Payout request not found" });
    if (payout.status !== "PENDING") return res.status(400).json({ message: `Payout is already ${payout.status}` });

    const reason = req.body.rejectionReason || "No reason provided";

    // Reject + return the amount to availableBalance
    const [updated] = await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id: payout.id },
        data: {
          status:          "REJECTED",
          processedById:   req.user.id,
          processedAt:     new Date(),
          rejectionReason: reason,
        },
      }),
      prisma.instructorWallet.update({
        where: { id: payout.walletId },
        data:  { availableBalance: { increment: payout.amount } }, // refund back
      }),
    ]);

    await notify({
      userId:  payout.instructorId,
      title:   "❌ Payout Rejected",
      message: `Your payout request of $${payout.amount.toFixed(2)} was rejected. Reason: ${reason}. The amount has been returned to your available balance.`,
      type:    "PAYOUT_REJECTED",
    });

    res.status(200).json({ message: "Payout rejected and amount returned to balance", payout: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject payout" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/wallet/admin/instructors   (Admin — all instructor wallets)
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllWallets = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const wallets = await prisma.instructorWallet.findMany({
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        _count:     { select: { earnings: true, payoutRequests: true } },
      },
      orderBy: { totalEarned: "desc" },
    });

    res.status(200).json(wallets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch wallets" });
  }
};
