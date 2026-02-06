const prisma = require("../prisma");

// ===================== CREATE COURSE (Instructor) =====================
exports.createCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, price, categoryId, thumbnail } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "Title and description are required" });
    }

    // Create course as DRAFT initially
    const course = await prisma.course.create({
      data: {
        title,
        description,
        price: price || 0,
        categoryId: categoryId || null,
        thumbnail: thumbnail || null,
        instructorId: userId,
        status: "DRAFT",
      },
    });

    res.status(201).json({
      message: "Course created successfully. Awaiting admin approval.",
      course,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create course" });
  }
};

// ===================== UPDATE COURSE (Instructor/Admin) =====================
exports.updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.id;
    const { title, description, price, categoryId, thumbnail } = req.body;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Only instructor of course or admin can update
    if (req.user.role === "INSTRUCTOR" && course.instructorId !== userId) {
      return res
        .status(403)
        .json({ message: "You are not allowed to update this course" });
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        title,
        description,
        price,
        categoryId,
        thumbnail,
        status: req.user.role === "ADMIN" ? "PUBLISHED" : "PENDING_REVIEW", // instructor update → pending review
      },
    });

    res
      .status(200)
      .json({ message: "Course updated successfully", course: updatedCourse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update course" });
  }
};

// ===================== ADMIN APPROVE / REJECT COURSE =====================
exports.approveCourse = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ message: "Only admin can approve courses" });
    }

    const courseId = req.params.id;
    const { approve, rejectionReason } = req.body; // approve = true/false

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        status: approve ? "PUBLISHED" : "REJECTED",
        approvedById: req.user.id,
        approvedAt: approve ? new Date() : null,
        rejectionReason: approve
          ? null
          : rejectionReason || "No reason provided",
      },
    });

    res.status(200).json({
      message: approve ? "Course approved and published" : "Course rejected",
      course: updatedCourse,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to approve/reject course" });
  }
};

// ===================== GET ALL COURSES =====================
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        instructor: { select: { id: true, fullName: true, email: true } },
        category: true,
      },
    });

    res.status(200).json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

// ===================== GET COURSE DETAIL =====================
exports.getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructor: { select: { id: true, fullName: true, email: true } },
        category: true,
        lessons: true,
      },
    });

    if (!course) return res.status(404).json({ message: "Course not found" });

    res.status(200).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch course details" });
  }
};
