const prisma = require("../prisma");

// ===================== MARK LESSON COMPLETE =====================
exports.markComplete = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lessonId } = req.body;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    // Check enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseId } },
    });
    if (!enrollment) return res.status(403).json({ message: "Not enrolled in this course" });

    const progress = await prisma.progress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { completed: true },
      create: { userId, lessonId, completed: true },
    });

    res.status(200).json({ message: "Lesson marked complete", progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark lesson complete" });
  }
};

// ===================== GET COURSE PROGRESS =====================
exports.getCourseProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;

    const lessons = await prisma.lesson.findMany({ where: { courseId } });
    const completed = await prisma.progress.findMany({
      where: { userId, lessonId: { in: lessons.map((l) => l.id) }, completed: true },
    });

    const completedIds = completed.map((p) => p.lessonId);
    const percentage = lessons.length > 0
      ? Math.round((completed.length / lessons.length) * 100)
      : 0;

    res.status(200).json({
      totalLessons: lessons.length,
      completedLessons: completed.length,
      percentage,
      completedLessonIds: completedIds,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch progress" });
  }
};