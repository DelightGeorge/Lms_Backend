// src/controllers/progressController.js
const prisma      = require("../prisma");
const { notify }  = require("../utils/notificationHelper");

// ===================== MARK LESSON COMPLETE =====================
exports.markComplete = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { lessonId } = req.body;

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { include: { instructor: true } } },
    });
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    // Check enrolled
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.courseId } },
    });
    if (!enrollment) return res.status(403).json({ message: "Not enrolled in this course" });

    // Upsert progress
    const progress = await prisma.progress.upsert({
      where:  { userId_lessonId: { userId, lessonId } },
      update: { completed: true },
      create: { userId, lessonId, completed: true },
    });

    // ── Check if course is now fully complete ──────────────────
    const allLessons = await prisma.lesson.findMany({
      where: { courseId: lesson.courseId },
    });
    const completedCount = await prisma.progress.count({
      where: {
        userId,
        lessonId: { in: allLessons.map((l) => l.id) },
        completed: true,
      },
    });

    const isCourseComplete = completedCount === allLessons.length;

    if (isCourseComplete) {
      // ── Notify student: course completed ─────────────────────
      await notify({
        userId,
        title: "🎉 Course Completed!",
        message: `Congratulations! You've completed "${lesson.course.title}". Your certificate is now available.`,
        type: "COURSE_COMPLETED",
      });

      // ── Notify instructor: student finished their course ──────
      if (lesson.course.instructor) {
        const student = await prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        });
        await notify({
          userId: lesson.course.instructorId,
          title: "🏆 Student Completed Your Course",
          message: `${student?.fullName || "A student"} just completed your course "${lesson.course.title}".`,
          type: "COURSE_COMPLETED",
        });
      }
    }

    res.status(200).json({
      message:          "Lesson marked complete",
      progress,
      isCourseComplete,
      completedLessons: completedCount,
      totalLessons:     allLessons.length,
      percentage:       Math.round((completedCount / allLessons.length) * 100),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark lesson complete" });
  }
};

// ===================== GET COURSE PROGRESS =====================
exports.getCourseProgress = async (req, res) => {
  try {
    const userId   = req.user.id;
    const { courseId } = req.params;

    const lessons = await prisma.lesson.findMany({ where: { courseId } });
    const completed = await prisma.progress.findMany({
      where: {
        userId,
        lessonId:  { in: lessons.map((l) => l.id) },
        completed: true,
      },
    });

    res.status(200).json({
      totalLessons:       lessons.length,
      completedLessons:   completed.length,
      percentage:         lessons.length > 0 ? Math.round((completed.length / lessons.length) * 100) : 0,
      completedLessonIds: completed.map((p) => p.lessonId),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch progress" });
  }
};
