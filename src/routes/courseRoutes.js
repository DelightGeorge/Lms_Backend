// src/routes/courseRoutes.js
const express = require("express");
const router  = express.Router();
const {
  createCourse,
  updateCourse,
  deleteCourse,
  approveCourse,
  getAllCourses,
  getCourseById,
  submitCourse,
  getInstructorCourses,
} = require("../controllers/courseController");
const protect = require("../middlewares/auth");

// ── specific named routes FIRST (must be before /:id) ─────
router.get("/instructor/my-courses", protect, getInstructorCourses);

// ── collection routes ──────────────────────────────────────
router.get("/",  getAllCourses);
router.post("/", protect, createCourse);

// ── approval route ─────────────────────────────────────────
router.patch("/approve/:id", protect, approveCourse);

// ── dynamic id routes LAST ─────────────────────────────────
router.get("/:id",           getCourseById);
router.patch("/:id",         protect, updateCourse);
router.delete("/:id",        protect, deleteCourse);      // ← was missing
router.patch("/:id/submit",  protect, submitCourse);

module.exports = router;