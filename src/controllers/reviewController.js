// src/controllers/reviewController.js
const prisma = require("../prisma");
const { notify } = require("../utils/notificationHelper");

const round1 = (n) => Math.round(n * 10) / 10;

const recalcAverage = async (courseId) => {
  const agg = await prisma.review.aggregate({
    where:  { courseId },
    _avg:   { rating: true },
    _count: { rating: true },
  });
  return {
    averageRating: round1(agg._avg.rating || 0),
    totalReviews:  agg._count.rating,
  };
};

// POST /api/reviews  — create or update (upsert)
exports.createReview = async (req, res) => {
  try {
    const { courseId, rating, comment } = req.body;
    const userId = req.user.id;

    if (!courseId || !rating) return res.status(400).json({ message: "courseId and rating are required" });
    if (rating < 1 || rating > 5) return res.status(400).json({ message: "Rating must be 1–5" });

    // Must be enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) return res.status(403).json({ message: "You must be enrolled to review this course" });

    // Check if this is a brand-new review (for notification purposes)
    const existing = await prisma.review.findUnique({
      where:  { userId_courseId: { userId, courseId } },
      select: { id: true },
    });
    const isNew = !existing;

    const review = await prisma.review.upsert({
      where:  { userId_courseId: { userId, courseId } },
      create: { userId, courseId, rating: Number(rating), comment: comment || null },
      update: { rating: Number(rating), comment: comment || null },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    const { averageRating, totalReviews } = await recalcAverage(courseId);

    // Notify instructor + all admins on NEW reviews only
    if (isNew) {
      const course = await prisma.course.findUnique({
        where:  { id: courseId },
        select: { title: true, instructorId: true },
      });

      const stars   = "★".repeat(Number(rating)) + "☆".repeat(5 - Number(rating));
      const preview = comment ? `: "${comment.slice(0, 80)}${comment.length > 80 ? "…" : ""}"` : ".";
      const notifTitle   = `New ${rating}-star review on "${course.title}"`;
      const notifMessage = `${review.user.fullName} gave ${stars}${preview}`;

      // Instructor
      if (course.instructorId) {
        await notify({ userId: course.instructorId, title: notifTitle, message: notifMessage, type: "REVIEW" });
      }

      // All admins
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await Promise.all(admins.map((a) =>
        notify({ userId: a.id, title: `[Admin] ${notifTitle}`, message: `Course: "${course.title}" — ${notifMessage}`, type: "REVIEW" })
      ));
    }

    res.status(200).json({ review, averageRating, totalReviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit review" });
  }
};

// GET /api/reviews/course/:courseId
exports.getReviewsByCourse = async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where:   { courseId: req.params.courseId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });
    const { averageRating, totalReviews } = await recalcAverage(req.params.courseId);
    res.status(200).json({ reviews, averageRating, totalReviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

// GET /api/reviews/my/:courseId  — student's own review
exports.getMyReview = async (req, res) => {
  try {
    const review = await prisma.review.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId: req.params.courseId } },
    });
    res.status(200).json({ review: review || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch your review" });
  }
};

// DELETE /api/reviews/:id
exports.deleteReview = async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.userId !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ message: "Not allowed" });
    await prisma.review.delete({ where: { id: req.params.id } });
    const { averageRating, totalReviews } = await recalcAverage(review.courseId);
    res.status(200).json({ message: "Deleted", averageRating, totalReviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete review" });
  }
};
