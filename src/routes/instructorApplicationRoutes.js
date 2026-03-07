// src/routes/instructorApplicationRoutes.js
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  applyAsInstructor,
  getMyApplication,
  getAllApplications,
  reviewApplication,
  getPendingCount,
} = require("../controllers/instructorApplicationController");

// ── Applicant routes ──────────────────────────────────────────────────────────
router.post("/",     protect, applyAsInstructor); // POST   /api/instructor-applications
router.get("/my",    protect, getMyApplication);  // GET    /api/instructor-applications/my

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get("/",              protect, getAllApplications); // GET    /api/instructor-applications
router.get("/pending-count", protect, getPendingCount);   // GET    /api/instructor-applications/pending-count
router.patch("/:id/review",  protect, reviewApplication); // PATCH  /api/instructor-applications/:id/review

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO index.js / app.js:
// ─────────────────────────────────────────────────────────────────────────────
// const instructorApplicationRoutes = require("./routes/instructorApplicationRoutes");
// app.use("/api/instructor-applications", instructorApplicationRoutes);
// ─────────────────────────────────────────────────────────────────────────────
