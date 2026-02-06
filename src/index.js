const express = require("express");
const cors = require("cors");
require("dotenv").config();

const courseRoutes = require("./routes/courseRoutes");
const authRoutes = require("./routes/authRoutes");
const prisma = require("./prisma");
const userRoutes = require("./routes/userRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/courses", courseRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);


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
