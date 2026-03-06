// src/controllers/adminController.js
const prisma     = require("../prisma");
const { notify } = require("../utils/notificationHelper");

// ── admin guard ───────────────────────────────────────────
const adminOnly = (req, res) => {
  if (req.user.role !== "ADMIN") {
    res.status(403).json({ message: "Admins only" });
    return false;
  }
  return true;
};

// ===================== GET STATS =====================
exports.getStats = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const [
      totalUsers, totalCourses, pendingCourses,
      publishedCourses, totalEnrollments, revenueData,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.course.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.course.count({ where: { status: "PUBLISHED" } }),
      prisma.enrollment.count(),
      prisma.enrollment.findMany({
        include: { course: { select: { price: true } } },
      }),
    ]);

    const totalRevenue = revenueData.reduce((acc, e) => acc + (e.course?.price || 0), 0);

    res.status(200).json({
      totalUsers, totalCourses, pendingCourses,
      publishedCourses, totalEnrollments, totalRevenue,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
};

// ===================== GET ANALYTICS =====================
exports.getAnalytics = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString("default", { month: "short" }), year: d.getFullYear(), month: d.getMonth() });
    }

    const enrollments = await prisma.enrollment.findMany({
      where:  { enrolledAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } },
      select: { enrolledAt: true, course: { select: { price: true } } },
    });

    const enrollmentsByMonth = months.map((m) => ({
      month:   m.label,
      count:   enrollments.filter((e) => { const d = new Date(e.enrolledAt); return d.getMonth() === m.month && d.getFullYear() === m.year; }).length,
      revenue: enrollments.filter((e) => { const d = new Date(e.enrolledAt); return d.getMonth() === m.month && d.getFullYear() === m.year; })
                          .reduce((acc, e) => acc + (e.course?.price || 0), 0),
    }));

    const users = await prisma.user.findMany({
      where:  { createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } },
      select: { createdAt: true },
    });

    const usersByMonth = months.map((m) => ({
      month: m.label,
      count: users.filter((u) => { const d = new Date(u.createdAt); return d.getMonth() === m.month && d.getFullYear() === m.year; }).length,
    }));

    const topCourses = await prisma.course.findMany({
      where:   { status: "PUBLISHED" },
      include: {
        instructor: { select: { fullName: true } },
        _count:     { select: { enrollments: true } },
      },
      orderBy: { enrollments: { _count: "desc" } },
      take:    5,
    });

    const instructors = await prisma.user.findMany({
      where:   { role: "INSTRUCTOR" },
      include: { courses: { include: { _count: { select: { enrollments: true } } } } },
    });

    const topInstructors = instructors
      .map((i) => ({
        id:            i.id,
        fullName:      i.fullName,
        email:         i.email,
        avatarUrl:     i.avatarUrl,
        courseCount:   i.courses.length,
        totalStudents: i.courses.reduce((acc, c) => acc + (c._count?.enrollments || 0), 0),
        totalRevenue:  i.courses.reduce((acc, c) => acc + ((c.price || 0) * (c._count?.enrollments || 0)), 0),
      }))
      .sort((a, b) => b.totalStudents - a.totalStudents)
      .slice(0, 5);

    res.status(200).json({
      enrollmentsByMonth,
      usersByMonth,
      topCourses: topCourses.map((c) => ({
        id:          c.id,
        title:       c.title,
        instructor:  c.instructor?.fullName,
        enrollments: c._count?.enrollments || 0,
        revenue:     (c.price || 0) * (c._count?.enrollments || 0),
        price:       c.price,
      })),
      topInstructors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

// ===================== GET PENDING COURSES =====================
exports.getPendingCourses = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const courses = await prisma.course.findMany({
      where:   { status: "PENDING_REVIEW" },
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        category:   true,
        _count:     { select: { lessons: true, enrollments: true } },
      },
    });
    res.status(200).json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch pending courses" });
  }
};

// ===================== GET ALL COURSES =====================
exports.getAllCourses = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const courses = await prisma.course.findMany({
      include: {
        instructor: { select: { id: true, fullName: true, email: true } },
        category:   true,
        _count:     { select: { lessons: true, enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

// ===================== GET COURSE DETAIL =====================
exports.getCourseDetail = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const course = await prisma.course.findUnique({
      where:   { id: req.params.id },
      include: {
        instructor:  { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        category:    true,
        lessons:     { orderBy: { order: "asc" } },
        resources:   true,
        enrollments: {
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
          orderBy: { enrolledAt: "desc" },
          take:    20,
        },
        _count: { select: { lessons: true, enrollments: true, reviews: true } },
      },
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.status(200).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch course detail" });
  }
};

// ===================== APPROVE / REJECT COURSE =====================
exports.reviewCourse = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const courseId = req.params.id;
    const { approve, rejectionReason } = req.body;

    const course = await prisma.course.findUnique({
      where:   { id: courseId },
      include: { instructor: true },
    });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data:  {
        status:          approve ? "PUBLISHED" : "REJECTED",
        approvedById:    req.user.id,
        approvedAt:      approve ? new Date() : null,
        rejectionReason: approve ? null : (rejectionReason || "No reason provided"),
      },
    });

    // ── Notify instructor ─────────────────────────────────────
    await notify({
      userId:  course.instructorId,
      title:   approve ? "🎉 Course Approved & Published!" : "❌ Course Needs Revision",
      message: approve
        ? `Your course "${course.title}" has been reviewed and is now live on the platform. Students can start enrolling!`
        : `Your course "${course.title}" was not approved. Reason: ${rejectionReason || "No reason provided"}. Please revise and resubmit.`,
      type:    approve ? "COURSE_APPROVED" : "COURSE_REJECTED",
    });

    // ── Notify other admins ───────────────────────────────────
    const otherAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", NOT: { id: req.user.id } },
    });
    for (const admin of otherAdmins) {
      await notify({
        userId:  admin.id,
        title:   approve ? "✅ Course Published" : "🚫 Course Rejected",
        message: `Admin ${req.user.fullName || "an admin"} ${approve ? "approved" : "rejected"} "${course.title}" by ${course.instructor?.fullName || "unknown"}.`,
        type:    "GENERAL",
      });
    }

    // ── If approved: notify already-enrolled students ─────────
    if (approve) {
      const enrollments = await prisma.enrollment.findMany({ where: { courseId } });
      for (const e of enrollments) {
        await notify({
          userId:  e.userId,
          title:   "📚 Enrolled Course Now Published",
          message: `"${course.title}" is now live and ready to learn!`,
          type:    "GENERAL",
        });
      }
    }

    res.status(200).json({
      message: approve ? "Course approved" : "Course rejected",
      course:  updatedCourse,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to review course" });
  }
};

// ===================== EDIT COURSE (Admin) =====================
exports.editCourse = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const existing = await prisma.course.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: "Course not found" });

    const { title, description, price, categoryId, thumbnail } = req.body;

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data:  {
        title, description,
        price:      price ? Number(price) : undefined,
        categoryId, thumbnail,
      },
    });

    // ── Notify instructor their course was edited ─────────────
    await notify({
      userId:  existing.instructorId,
      title:   "✏️ Course Updated by Admin",
      message: `An admin updated details on your course "${existing.title}".`,
      type:    "GENERAL",
    });

    res.status(200).json({ message: "Course updated", course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update course" });
  }
};

// ===================== DELETE COURSE (Admin) =====================
exports.deleteCourse = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const courseId = req.params.id;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Delete all related records in dependency order so foreign key
    // constraints are never violated.  Order matters:
    //   quiz attempts → quiz options → quiz questions → quizzes
    //   lesson progress → lessons
    //   resources, reviews, enrollments, notifications
    //   then the course itself

    // 1. Quiz attempts (reference quizzes)
    const quizzes = await prisma.quiz.findMany({
      where:  { courseId },
      select: { id: true },
    });
    const quizIds = quizzes.map((q) => q.id);

    if (quizIds.length > 0) {
      await prisma.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });

      // Quiz answer options (reference questions)
      const questions = await prisma.quizQuestion.findMany({
        where:  { quizId: { in: quizIds } },
        select: { id: true },
      });
      const questionIds = questions.map((q) => q.id);
      if (questionIds.length > 0) {
        await prisma.quizOption.deleteMany({ where: { questionId: { in: questionIds } } });
      }
      await prisma.quizQuestion.deleteMany({ where: { quizId: { in: quizIds } } });
      await prisma.quiz.deleteMany({ where: { courseId } });
    }

    // 2. Lesson progress (references lessons)
    const lessons = await prisma.lesson.findMany({
      where:  { courseId },
      select: { id: true },
    });
    const lessonIds = lessons.map((l) => l.id);
    if (lessonIds.length > 0) {
      await prisma.lessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await prisma.lesson.deleteMany({ where: { courseId } });
    }

    // 3. Resources, reviews, enrollments, notifications about this course
    await prisma.resource.deleteMany({ where: { courseId } });
    await prisma.review.deleteMany({ where: { courseId } });
    await prisma.enrollment.deleteMany({ where: { courseId } });

    // 4. Finally delete the course
    await prisma.course.delete({ where: { id: courseId } });

    // ── Notify instructor ─────────────────────────────────────
    await notify({
      userId:  course.instructorId,
      title:   "⚠️ Course Removed",
      message: `Your course "${course.title}" has been removed from the platform by an admin. Please contact support if you have questions.`,
      type:    "GENERAL",
    });

    res.status(200).json({ message: "Course deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete course" });
  }
};

// ===================== GET ALL USERS =====================
exports.getAllUsers = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const users = await prisma.user.findMany({
      select: {
        id: true, fullName: true, email: true, role: true,
        isEmailVerified: true, createdAt: true, avatarUrl: true, status: true,
        _count: { select: { enrollments: true, courses: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// ===================== DELETE USER (Admin) =====================
exports.deleteUser = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const userToDelete = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!userToDelete) return res.status(404).json({ message: "User not found" });

    await prisma.user.delete({ where: { id: req.params.id } });

    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};