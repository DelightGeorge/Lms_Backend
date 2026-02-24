const express = require("express");
const router = express.Router();
const {
  createCourse,
  updateCourse,
  approveCourse,
  getAllCourses,
  getCourseById,
  submitCourse,
  getInstructorCourses,  // ← add this
} = require("../controllers/courseController");
const protect = require("../middlewares/auth");

// ── specific routes FIRST ──
router.get("/instructor/my-courses", protect, getInstructorCourses); // ← must be before /:id
router.post("/", protect, createCourse);
router.get("/", getAllCourses);
router.patch("/approve/:id", protect, approveCourse);
router.patch("/:id/submit", protect, submitCourse);

// ── dynamic routes LAST ──
router.get("/:id", getCourseById);
router.patch("/:id", protect, updateCourse);

module.exports = router;