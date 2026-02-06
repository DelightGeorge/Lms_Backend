const express = require("express");
const cors = require("cors");
require("dotenv").config();

const courseRoutes = require("./routes/courseRoutes");
const authRoutes = require("./routes/authRoutes");
const prisma = require("./prisma");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const quizRoutes = require("./routes/quizRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const resourceRoutes = require("./routes/resourceRoutes");


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/courses", courseRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/resources", resourceRoutes);


app.get("/", (req, res) => {
  res.json({ status: "OK", message: "LMS Backend is Live 🚀" });
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1 AS result`;
    res.json({ message: "Database Connected ✅", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
