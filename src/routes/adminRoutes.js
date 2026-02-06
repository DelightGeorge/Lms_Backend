const express = require("express");
const router = express.Router();

const protect = require("../middlewares/auth");
const { getPendingCourses, reviewCourse } = require("../controllers/adminController");

// List all pending courses
router.get("/courses/pending", protect, getPendingCourses);

// Approve or reject a course
router.patch("/courses/:id/approve", protect, reviewCourse);

module.exports = router;
