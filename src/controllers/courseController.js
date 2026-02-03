import prisma from "../prisma.js"; // your prisma client

export const createCourse = async (req, res) => {
  try {
    const { title, description, price, categoryId } = req.body;
    const instructorId = req.user.id;

    let thumbnailUrl;
    if (req.file) thumbnailUrl = req.file.path;

    const course = await prisma.course.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        categoryId,
        instructorId,
        thumbnail: thumbnailUrl,
      },
    });

    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create course" });
  }
};
