const prisma = require("../prisma");

// ── helper: admin guard ───────────────────────────
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
      totalUsers, totalCourses, pendingCourses, publishedCourses,
      totalEnrollments, revenueData,
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

    // Last 6 months labels
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ label: d.toLocaleString("default", { month: "short" }), year: d.getFullYear(), month: d.getMonth() });
    }

    // Enrollments per month
    const enrollments = await prisma.enrollment.findMany({
      where: { enrolledAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } },
      select: { enrolledAt: true, course: { select: { price: true } } },
    });

    const enrollmentsByMonth = months.map((m) => ({
      month: m.label,
      count: enrollments.filter((e) => {
        const d = new Date(e.enrolledAt);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length,
      revenue: enrollments.filter((e) => {
        const d = new Date(e.enrolledAt);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).reduce((acc, e) => acc + (e.course?.price || 0), 0),
    }));

    // User growth per month
    const users = await prisma.user.findMany({
      where: { createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } },
      select: { createdAt: true },
    });

    const usersByMonth = months.map((m) => ({
      month: m.label,
      count: users.filter((u) => {
        const d = new Date(u.createdAt);
        return d.getMonth() === m.month && d.getFullYear() === m.year;
      }).length,
    }));

    // Top performing courses
    const topCourses = await prisma.course.findMany({
      where: { status: "PUBLISHED" },
      include: {
        instructor: { select: { fullName: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { enrollments: { _count: "desc" } },
      take: 5,
    });

    // Most active instructors
    const instructors = await prisma.user.findMany({
      where: { role: "INSTRUCTOR" },
      include: {
        courses: {
          include: { _count: { select: { enrollments: true } } },
        },
      },
    });

    const topInstructors = instructors
      .map((i) => ({
        id: i.id,
        fullName: i.fullName,
        email: i.email,
        avatarUrl: i.avatarUrl,
        courseCount: i.courses.length,
        totalStudents: i.courses.reduce((acc, c) => acc + (c._count?.enrollments || 0), 0),
        totalRevenue: i.courses.reduce((acc, c) => acc + ((c.price || 0) * (c._count?.enrollments || 0)), 0),
      }))
      .sort((a, b) => b.totalStudents - a.totalStudents)
      .slice(0, 5);

    res.status(200).json({
      enrollmentsByMonth,
      usersByMonth,
      topCourses: topCourses.map((c) => ({
        id: c.id,
        title: c.title,
        instructor: c.instructor?.fullName,
        enrollments: c._count?.enrollments || 0,
        revenue: (c.price || 0) * (c._count?.enrollments || 0),
        price: c.price,
      })),
      topInstructors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

// ===================== GET ALL PENDING COURSES =====================
exports.getPendingCourses = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const pendingCourses = await prisma.course.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        category: true,
        _count: { select: { lessons: true, enrollments: true } },
      },
    });
    res.status(200).json(pendingCourses);
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
        category: true,
        _count: { select: { lessons: true, enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

// ===================== GET COURSE DETAIL (Admin) =====================
exports.getCourseDetail = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        category: true,
        lessons: { orderBy: { order: "asc" } },
        enrollments: {
          include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
          orderBy: { enrolledAt: "desc" },
          take: 20,
        },
        resources: true,
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

    const course = await prisma.course.findUnique({ where: { id: courseId }, include: { instructor: true } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        status: approve ? "PUBLISHED" : "REJECTED",
        approvedById: req.user.id,
        approvedAt: approve ? new Date() : null,
        rejectionReason: approve ? null : rejectionReason || "No reason provided",
      },
    });

    await prisma.notification.create({
      data: {
        title: approve ? "Course Approved" : "Course Rejected",
        message: approve
          ? `Your course "${course.title}" has been approved and published!`
          : `Your course "${course.title}" was rejected. Reason: ${updatedCourse.rejectionReason}`,
        type: "COURSE_PUBLISHED",
        userId: course.instructorId,
      },
    });

    res.status(200).json({ message: approve ? "Course approved" : "Course rejected", course: updatedCourse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to review course" });
  }
};

// ===================== EDIT COURSE (Admin) =====================
exports.editCourse = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    const { title, description, price, categoryId, thumbnail } = req.body;
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { title, description, price: price ? Number(price) : undefined, categoryId, thumbnail },
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
    await prisma.course.delete({ where: { id: req.params.id } });
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

// ===================== DELETE USER =====================
exports.deleteUser = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};