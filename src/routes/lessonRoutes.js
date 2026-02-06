const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const lessonController = require("../controllers/lessonController");

// Instructor routes
router.post("/", verifyToken, lessonController.createLesson);
router.patch("/:id", verifyToken, lessonController.updateLesson);
router.delete("/:id", verifyToken, lessonController.deleteLesson);

// Public / course-specific routes
router.get("/course/:courseId", lessonController.getLessonsByCourse);

module.exports = router;
