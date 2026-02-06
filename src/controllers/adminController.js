// src/controllers/adminController.js
const prisma = require("../prisma");

// ===================== APPROVE / REJECT COURSE =====================
exports.reviewCourse = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can review courses" });
    }

    const courseId = req.params.id;
    const { approve, rejectionReason } = req.body;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructor: true },
    });
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Update course status
    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        status: approve ? "PUBLISHED" : "REJECTED",
        approvedById: req.user.id,
        approvedAt: approve ? new Date() : null,
        rejectionReason: approve ? null : rejectionReason || "No reason provided",
      },
    });

    // Create a notification for the instructor
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

    res.status(200).json({
      message: approve ? "Course approved and published" : "Course rejected",
      course: updatedCourse,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to review course" });
  }
};

// ===================== GET ALL PENDING COURSES =====================
exports.getPendingCourses = async (req, res) => {
  try {
    // Only admin can view pending courses
    if (req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "Only admins can view pending courses" });
    }

    const pendingCourses = await prisma.course.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        instructor: { select: { id: true, fullName: true, email: true } },
        category: true,
      },
    });

    res.status(200).json(pendingCourses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch pending courses" });
  }
};