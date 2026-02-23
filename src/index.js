const express = require("express");
const cors = require("cors");
require("dotenv").config();

const prisma = require("./prisma");

// Routes
const courseRoutes = require("./routes/courseRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const adminRoutes = require("./routes/adminRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const quizRoutes = require("./routes/quizRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const resourceRoutes = require("./routes/resourceRoutes");
const cartRoutes = require("./routes/cartRoutes");

const app = express();

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://lms-frontend-phi-khaki.vercel.app", // ← your actual Vercel URL
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
app.use(cors(corsOptions));

// 2️⃣ Middleware to parse requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3️⃣ Routes
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
app.use("/api/cart", cartRoutes);

// 4️⃣ Test endpoints
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

// 5️⃣ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running at port ${PORT}`));
