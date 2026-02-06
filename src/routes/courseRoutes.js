const express = require("express");
const router = express.Router();
const { createCourse, updateCourse, approveCourse, getAllCourses, getCourseById } = require("../controllers/courseController");
const protect = require("../middlewares/auth");

// Instructor creates course
router.post("/", protect, createCourse);

// Instructor/Admin updates course
router.patch("/:id", protect, updateCourse);

// Admin approves/rejects course
router.patch("/approve/:id", protect, approveCourse);

// Public routes
router.get("/", getAllCourses);
router.get("/:id", getCourseById);

module.exports = router;
