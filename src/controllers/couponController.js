// src/controllers/couponController.js
//
// Instructors create/manage coupons for their own courses.
// Students validate a coupon during checkout.
//
const prisma = require("../prisma");

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/coupons   (Instructor)
// Body: { code, discountPct, courseId?, maxUsage?, expiresAt? }
// If courseId is omitted the coupon applies to ALL instructor courses.
// ─────────────────────────────────────────────────────────────────────────────
exports.createCoupon = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const { code, discountPct, maxUsage, expiresAt } = req.body;

    if (!code)                                         return res.status(400).json({ message: "Coupon code is required" });
    if (!discountPct || discountPct < 1 || discountPct > 100) return res.status(400).json({ message: "discountPct must be 1-100" });

    const upper = code.toUpperCase().trim().replace(/\s+/g, "_");

    // Check uniqueness
    const exists = await prisma.coupon.findUnique({ where: { code: upper } });
    if (exists) return res.status(400).json({ message: "Coupon code already exists" });

    const coupon = await prisma.coupon.create({
      data: {
        code:         upper,
        instructorId: req.user.id,
        discountPct:  parseFloat(discountPct),
        maxUsage:     maxUsage ? parseInt(maxUsage) : null,
        expiresAt:    expiresAt ? new Date(expiresAt) : null,
      },
    });

    res.status(201).json({ message: "Coupon created", coupon });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create coupon" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coupons/mine   (Instructor — own coupons)
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyCoupons = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const coupons = await prisma.coupon.findMany({
      where:   { instructorId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(coupons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/coupons/:id   (Instructor — toggle active / update)
// Body: { isActive?, maxUsage?, expiresAt? }
// ─────────────────────────────────────────────────────────────────────────────
exports.updateCoupon = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon)                              return res.status(404).json({ message: "Coupon not found" });
    if (coupon.instructorId !== req.user.id)  return res.status(403).json({ message: "Not your coupon" });

    const { isActive, maxUsage, expiresAt } = req.body;

    const updated = await prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        ...(isActive  !== undefined && { isActive: Boolean(isActive) }),
        ...(maxUsage  !== undefined && { maxUsage: maxUsage ? parseInt(maxUsage) : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });

    res.status(200).json({ message: "Coupon updated", coupon: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update coupon" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/coupons/:id   (Instructor)
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteCoupon = async (req, res) => {
  try {
    if (req.user.role !== "INSTRUCTOR") return res.status(403).json({ message: "Instructors only" });

    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon)                             return res.status(404).json({ message: "Coupon not found" });
    if (coupon.instructorId !== req.user.id) return res.status(403).json({ message: "Not your coupon" });

    await prisma.coupon.delete({ where: { id: coupon.id } });
    res.status(200).json({ message: "Coupon deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete coupon" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/coupons/validate?code=XYZ&courseId=ABC   (Student — public)
// Returns discount info without revealing backend split logic.
// ─────────────────────────────────────────────────────────────────────────────
exports.validateCoupon = async (req, res) => {
  try {
    const { code, courseId } = req.query;
    if (!code || !courseId) return res.status(400).json({ message: "code and courseId are required" });

    const revenueService = require("../services/revenueService");
    const result = await revenueService.validateCoupon(code, courseId);

    if (!result.valid) {
      return res.status(200).json({ valid: false, message: "Invalid or expired coupon" });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId }, select: { price: true } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const discounted = parseFloat((course.price * (1 - result.discountPct / 100)).toFixed(2));

    res.status(200).json({
      valid:       true,
      code:        result.coupon.code,
      discountPct: result.discountPct,
      originalPrice:  course.price,
      discountedPrice: discounted,
      savings:         parseFloat((course.price - discounted).toFixed(2)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to validate coupon" });
  }
};
