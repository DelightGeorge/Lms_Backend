import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "@prisma/client";

dotenv.config();

const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Backend running 🚀" });
});

app.get("/test-db", async (req, res) => {
  try {
    // Testing the connection
    const result = await prisma.$queryRaw`SELECT 1 AS result`;
    res.json({ message: "Prisma client connected ✅", result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));