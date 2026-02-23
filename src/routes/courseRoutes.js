const express = require("express");
const router = express.Router();
const {
  createCourse, updateCourse, approveCourse,
  getAllCourses, getCourseById, submitCourse
} = require("../controllers/courseController");
const protect = require("../middlewares/auth");

// ── specific routes FIRST ──
router.post("/", protect, createCourse);
router.get("/", getAllCourses);
router.patch("/approve/:id", protect, approveCourse); // ← must be before /:id
router.patch("/:id/submit", protect, submitCourse);   // ← must be before /:id

// ── dynamic routes LAST ──
router.get("/:id", getCourseById);
router.patch("/:id", protect, updateCourse);

module.exports = router;