// src/controllers/enrollmentController.js
const prisma     = require("../prisma");
const { notify } = require("../utils/notificationHelper");

// ===================== ENROLL IN FREE COURSE =====================
exports.enrollFree = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { courseId } = req.body;

    const course = await prisma.course.findUnique({
      where:   { id: courseId },
      include: { instructor: true },
    });
    if (!course)                    return res.status(404).json({ message: "Course not found" });
    if (course.status !== "PUBLISHED") return res.status(400).json({ message: "Course not available" });
    if (course.price > 0)           return res.status(400).json({ message: "This course requires payment" });

    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return res.status(400).json({ message: "Already enrolled" });

    const enrollment = await prisma.enrollment.create({ data: { userId, courseId } });

    const student = await prisma.user.findUnique({
      where:  { id: userId },
      select: { fullName: true, email: true },
    });

    // ── Notify student ────────────────────────────────────────
    await notify({
      userId,
      title:   "🎓 Enrollment Successful",
      message: `You're now enrolled in "${course.title}". Start learning today!`,
      type:    "ENROLLMENT",
    });

    // ── Notify instructor ─────────────────────────────────────
    if (course.instructorId) {
      await notify({
        userId:  course.instructorId,
        title:   "👤 New Student Enrolled",
        message: `${student?.fullName || "A new student"} just enrolled in your course "${course.title}".`,
        type:    "ENROLLMENT",
      });
    }

    // ── Notify all admins ─────────────────────────────────────
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const admin of admins) {
      await notify({
        userId:  admin.id,
        title:   "📊 New Free Enrollment",
        message: `${student?.fullName || "A student"} enrolled in "${course.title}".`,
        type:    "ENROLLMENT",
      });
    }

    res.status(201).json({ message: "Enrolled successfully", enrollment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to enroll" });
  }
};

// ===================== CHECK ENROLLMENT =====================
exports.checkEnrollment = async (req, res) => {
  try {
    const userId   = req.user.id;
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
      where:   { userId },
      include: {
        course: {
          include: {
            instructor: { select: { id: true, fullName: true, avatarUrl: true } },
            category:   true,
            lessons:    { orderBy: { order: "asc" } },
            _count:     { select: { lessons: true, enrollments: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });

    // Attach progress to each enrollment
    const enriched = await Promise.all(
      enrollments.map(async (e) => {
        const total     = e.course._count.lessons;
        const completed = await prisma.progress.count({
          where: { userId, lesson: { courseId: e.courseId }, completed: true },
        });
        return {
          ...e,
          progress:         total > 0 ? Math.round((completed / total) * 100) : 0,
          completedLessons: completed,
          totalLessons:     total,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch enrollments" });
  }
};
