// src/controllers/courseController.js
const prisma     = require("../prisma");
const { notify } = require("../utils/notificationHelper");

// ── helper: resolve categoryId from name OR id ────────────
const resolveCategoryId = async (categoryId, categoryName) => {
  if (categoryId) return categoryId;
  if (categoryName) {
    const cat = await prisma.category.findFirst({
      where: { name: { equals: categoryName, mode: "insensitive" } },
    });
    return cat?.id || null;
  }
  return null;
};

// ===================== CREATE COURSE (Instructor) =====================
exports.createCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, price, categoryId, category, thumbnail } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }

    const resolvedCategoryId = await resolveCategoryId(categoryId, category);

    const course = await prisma.course.create({
      data: {
        title,
        description,
        price:        price ? Number(price) : 0,
        categoryId:   resolvedCategoryId,
        thumbnail:    thumbnail || null,
        instructorId: userId,
        status:       "DRAFT",
      },
      include: {
        category: true,
        _count:   { select: { enrollments: true, lessons: true } },
      },
    });

    // Notify instructor
    await notify({
      userId,
      title:   "📚 Course Created",
      message: `Your course "${title}" has been created as a draft. Add lessons and submit it for review when ready.`,
      type:    "GENERAL",
    });

    // Notify admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const admin of admins) {
      await notify({
        userId:  admin.id,
        title:   "📝 New Course Draft Created",
        message: `Instructor ${req.user.fullName || "unknown"} created a new course draft: "${title}".`,
        type:    "GENERAL",
      });
    }

    res.status(201).json({ message: "Course created successfully.", course });
  } catch (err) {
    console.error("createCourse error:", err);
    res.status(500).json({ message: "Failed to create course", error: err.message });
  }
};

// ===================== UPDATE COURSE (Instructor/Admin) =====================
exports.updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId   = req.user.id;
    const { title, description, price, categoryId, category, thumbnail } = req.body;

    const existing = await prisma.course.findUnique({ where: { id: courseId } });
    if (!existing) return res.status(404).json({ message: "Course not found" });

    if (req.user.role === "INSTRUCTOR" && existing.instructorId !== userId) {
      return res.status(403).json({ message: "Not allowed to update this course" });
    }

    const resolvedCategoryId = await resolveCategoryId(categoryId, category);

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data:  {
        title:       title       !== undefined ? title       : existing.title,
        description: description !== undefined ? description : existing.description,
        price:       price       !== undefined ? Number(price) : existing.price,
        categoryId:  resolvedCategoryId        ?? existing.categoryId,
        thumbnail:   thumbnail   !== undefined ? thumbnail   : existing.thumbnail,
        // Do NOT change status on update — instructor submits separately
      },
      include: {
        category: true,
        _count:   { select: { enrollments: true, lessons: true } },
      },
    });

    res.status(200).json({ message: "Course updated successfully", course: updatedCourse });
  } catch (err) {
    console.error("updateCourse error:", err);
    res.status(500).json({ message: "Failed to update course", error: err.message });
  }
};

// ===================== DELETE COURSE (Instructor/Admin) =====================
exports.deleteCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId   = req.user.id;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role === "INSTRUCTOR" && course.instructorId !== userId) {
      return res.status(403).json({ message: "Not allowed to delete this course" });
    }

    await prisma.course.delete({ where: { id: courseId } });

    res.status(200).json({ message: "Course deleted" });
  } catch (err) {
    console.error("deleteCourse error:", err);
    res.status(500).json({ message: "Failed to delete course", error: err.message });
  }
};

// ===================== SUBMIT COURSE FOR REVIEW (Instructor) =====================
exports.submitCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId   = req.user.id;

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course)                            return res.status(404).json({ message: "Course not found" });
    if (course.instructorId !== userId)     return res.status(403).json({ message: "Not authorized" });
    if (course.status === "PUBLISHED")      return res.status(400).json({ message: "Course is already published" });
    if (course.status === "PENDING_REVIEW") return res.status(400).json({ message: "Course is already pending review" });

    await prisma.course.update({
      where: { id: courseId },
      data:  { status: "PENDING_REVIEW" },
    });

    // Notify instructor
    await notify({
      userId,
      title:   "📤 Course Submitted for Review",
      message: `Your course "${course.title}" has been submitted and is pending admin review. We'll notify you once it's reviewed.`,
      type:    "GENERAL",
    });

    // Notify all admins
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
    for (const admin of admins) {
      await notify({
        userId:  admin.id,
        title:   "🔔 New Course Pending Review",
        message: `Instructor ${req.user.fullName || "unknown"} submitted "${course.title}" for review.`,
        type:    "GENERAL",
      });
    }

    res.status(200).json({ message: "Course submitted for admin review" });
  } catch (err) {
    console.error("submitCourse error:", err);
    res.status(500).json({ message: "Failed to submit course", error: err.message });
  }
};

// ===================== GET ALL COURSES (public — published only) =====================
exports.getAllCourses = async (req, res) => {
  try {
    const { search } = req.query;

    const courses = await prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        ...(search ? {
          OR: [
            { title:       { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: {
        instructor: { select: { id: true, fullName: true, email: true } },
        category:   true,
        _count:     { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(courses);
  } catch (err) {
    console.error("getAllCourses error:", err);
    res.status(500).json({ message: "Failed to fetch courses" });
  }
};

// ===================== GET COURSE DETAIL =====================
exports.getCourseById = async (req, res) => {
  try {
    const course = await prisma.course.findUnique({
      where:   { id: req.params.id },
      include: {
        instructor: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        category:   true,
        lessons:    { orderBy: { order: "asc" } },
        resources:  true,
        _count:     { select: { enrollments: true } },
      },
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.status(200).json(course);
  } catch (err) {
    console.error("getCourseById error:", err);
    res.status(500).json({ message: "Failed to fetch course details" });
  }
};

// ===================== GET INSTRUCTOR'S OWN COURSES =====================
exports.getInstructorCourses = async (req, res) => {
  try {
    const courses = await prisma.course.findMany({
      where:   { instructorId: req.user.id },  // ALL statuses
      include: {
        category: true,
        lessons:  { orderBy: { order: "asc" } },
        _count:   { select: { enrollments: true, lessons: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(courses);
  } catch (err) {
    console.error("getInstructorCourses error:", err);
    res.status(500).json({ message: "Failed to fetch your courses" });
  }
};

// ===================== APPROVE / REJECT COURSE (Admin) =====================
exports.approveCourse = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admin can approve courses" });
    }
    const { approve, rejectionReason } = req.body;

    const course = await prisma.course.findUnique({
      where:   { id: req.params.id },
      include: { instructor: true },
    });
    if (!course) return res.status(404).json({ message: "Course not found" });

    const updatedCourse = await prisma.course.update({
      where: { id: req.params.id },
      data:  {
        status:          approve ? "PUBLISHED" : "REJECTED",
        approvedById:    req.user.id,
        approvedAt:      approve ? new Date() : null,
        rejectionReason: approve ? null : (rejectionReason || "No reason provided"),
      },
    });

    await notify({
      userId:  course.instructorId,
      title:   approve ? "🎉 Course Approved & Published!" : "❌ Course Needs Revision",
      message: approve
        ? `Your course "${course.title}" has been approved and is now live on the platform!`
        : `Your course "${course.title}" was not approved. Reason: ${rejectionReason || "No reason provided"}. Please revise and resubmit.`,
      type:    approve ? "COURSE_APPROVED" : "COURSE_REJECTED",
    });

    res.status(200).json({
      message: approve ? "Course approved and published" : "Course rejected",
      course:  updatedCourse,
    });
  } catch (err) {
    console.error("approveCourse error:", err);
    res.status(500).json({ message: "Failed to approve/reject course" });
  }
};
