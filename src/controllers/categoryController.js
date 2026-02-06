const prisma = require("../prisma");

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check if category already exists
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: "Category already exists" });
    }

    const category = await prisma.category.create({
      data: { name },
    });

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create category" });
  }
};

// List all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.status(200).json({ categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};
