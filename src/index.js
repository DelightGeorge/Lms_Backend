import express from "express";
import cors from "cors";
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client"; // Default location

const app = express();
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL Connection
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// Initialize Prisma with the adapter (REQUIRED in v7)
const prisma = new PrismaClient({ adapter });

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