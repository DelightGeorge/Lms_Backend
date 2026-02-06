const prisma = require("../prisma");

// ===================== CREATE REVIEW =====================
exports.createReview = async (req, res) => {
  try {
    const { courseId, rating, comment } = req.body;

    if (!courseId || !rating) return res.status(400).json({ message: "Course and rating are required" });

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId } },
    });
    if (!enrollment) return res.status(403).json({ message: "You must enroll to review" });

    const review = await prisma.review.upsert({
      where: { userId_courseId: { userId: req.user.id, courseId } },
      update: { rating, comment },
      create: { courseId, userId: req.user.id, rating, comment },
    });

    res.status(200).json({ message: "Review submitted", review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit review" });
  }
};

// ===================== GET REVIEWS =====================
exports.getReviewsByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const reviews = await prisma.review.findMany({
      where: { courseId },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
};
