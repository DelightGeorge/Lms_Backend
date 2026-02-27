// src/controllers/lessonController.js
const prisma     = require("../prisma");
const { notify } = require("../utils/notificationHelper");

// ===================== CREATE LESSON =====================
exports.createLesson = async (req, res) => {
  try {
    const { courseId, title, content, type, order, videoUrl } = req.body;
    const userId = req.user.id;

    if (!courseId || !title || !type) {
      return res.status(400).json({ message: "Course, title, and type are required" });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role !== "INSTRUCTOR" || course.instructorId !== userId) {
      return res.status(403).json({ message: "You cannot add lessons to this course" });
    }

    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        title,
        content: videoUrl || content || "",
        type,
        order: order || 1,
      },
    });

    // ── Notify all enrolled students ──────────────────────────
    // Only notify if course is published (no point notifying on draft courses)
    if (course.status === "PUBLISHED") {
      const enrollments = await prisma.enrollment.findMany({
        where: { courseId },
      });
      for (const e of enrollments) {
        await notify({
          userId:  e.userId,
          title:   "📖 New Lesson Available",
          message: `A new ${type === "VIDEO" ? "video" : "text"} lesson "${title}" has been added to "${course.title}". Check it out!`,
          type:    "GENERAL",
        });
      }
    }

    res.status(201).json({ message: "Lesson created", lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create lesson" });
  }
};

// ===================== UPDATE LESSON =====================
exports.updateLesson = async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { title, content, type, order, videoUrl } = req.body;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    const course = await prisma.course.findUnique({ where: { id: lesson.courseId } });
    if (req.user.role !== "INSTRUCTOR" || course.instructorId !== req.user.id) {
      return res.status(403).json({ message: "You cannot edit this lesson" });
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title:   title   ?? lesson.title,
        content: videoUrl || content || lesson.content,
        type:    type    ?? lesson.type,
        order:   order   ?? lesson.order,
      },
    });

    res.status(200).json({ message: "Lesson updated", lesson: updatedLesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update lesson" });
  }
};

// ===================== DELETE LESSON =====================
exports.deleteLesson = async (req, res) => {
  try {
    const lessonId = req.params.id;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    const course = await prisma.course.findUnique({ where: { id: lesson.courseId } });
    if (req.user.role !== "INSTRUCTOR" || course.instructorId !== req.user.id) {
      return res.status(403).json({ message: "You cannot delete this lesson" });
    }

    await prisma.lesson.delete({ where: { id: lessonId } });

    res.status(200).json({ message: "Lesson deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete lesson" });
  }
};

// ===================== GET LESSONS BY COURSE =====================
exports.getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const lessons = await prisma.lesson.findMany({
      where:   { courseId },
      orderBy: { order: "asc" },
    });
    res.status(200).json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch lessons" });
  }
};
