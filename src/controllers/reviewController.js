// src/controllers/reviewController.js
const prisma = require("../prisma");

exports.createReview = async (req, res) => {
  try {
    const { courseId, rating, comment } = req.body;
    if (!courseId || !rating) return res.status(400).json({ message: "Course and rating are required" });

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId } },
    });
    if (!enrollment) return res.status(403).json({ message: "You must be enrolled to review" });

    const review = await prisma.review.upsert({
      where:  { userId_courseId: { userId: req.user.id, courseId } },
      update: { rating, comment },
      create: { courseId, userId: req.user.id, rating, comment },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    });

    res.status(200).json({ message: "Review submitted", review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit review" });
  }
};

exports.getReviewsByCourse = async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where:   { courseId: req.params.courseId },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    res.status(200).json({ reviews, averageRating: Number(avg), totalReviews: reviews.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) return res.status(404).json({ message: "Review not found" });
    if (review.userId !== req.user.id && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Not allowed" });
    }
    await prisma.review.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Review deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete review" });
  }
};
