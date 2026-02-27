const prisma = require("../prisma");

// ===================== ENROLL IN FREE COURSE =====================
exports.enrollFree = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.status !== "PUBLISHED") return res.status(400).json({ message: "Course not available" });
    if (course.price > 0) return res.status(400).json({ message: "This course requires payment" });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return res.status(400).json({ message: "Already enrolled" });

    const enrollment = await prisma.enrollment.create({
      data: { userId, courseId },
    });

    await prisma.notification.create({
      data: {
        title: "Enrollment Successful",
        message: `You have successfully enrolled in "${course.title}"`,
        type: "ENROLLMENT",
        userId,
      },
    });

    res.status(201).json({ message: "Enrolled successfully", enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to enroll" });
  }
};

// ===================== CHECK ENROLLMENT =====================
exports.checkEnrollment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    res.status(200).json({ enrolled: !!enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to check enrollment" });
  }
};

// ===================== GET MY ENROLLMENTS =====================
exports.getMyEnrollments = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            instructor: { select: { id: true, fullName: true, avatarUrl: true } },
            category: true,
            lessons: { orderBy: { order: "asc" } },
            _count: { select: { lessons: true, enrollments: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    // Add progress for each course
    const enrollmentsWithProgress = await Promise.all(
      enrollments.map(async (e) => {
        const totalLessons = e.course._count.lessons;
        const completedLessons = await prisma.progress.count({
          where: { userId, lesson: { courseId: e.courseId }, completed: true },
        });
        return {
          ...e,
          progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
          completedLessons,
          totalLessons,
        };
      })
    );

    res.status(200).json(enrollmentsWithProgress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch enrollments" });
  }
};