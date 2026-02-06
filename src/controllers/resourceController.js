const prisma = require("../prisma");

// ===================== ADD RESOURCE =====================
exports.addResource = async (req, res) => {
  try {
    const { courseId, title, fileUrl } = req.body;

    if (!courseId || !title || !fileUrl) return res.status(400).json({ message: "All fields are required" });

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role !== "INSTRUCTOR" || course.instructorId !== req.user.id) {
      return res.status(403).json({ message: "You cannot add resources to this course" });
    }

    const resource = await prisma.resource.create({ data: { courseId, title, fileUrl } });

    res.status(201).json({ message: "Resource added", resource });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add resource" });
  }
};

// ===================== GET RESOURCES =====================
exports.getResourcesByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const resources = await prisma.resource.findMany({ where: { courseId } });

    res.status(200).json(resources);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch resources" });
  }
};
