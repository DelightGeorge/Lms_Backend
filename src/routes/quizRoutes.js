const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const quizController = require("../controllers/quizController");

// Instructor routes
router.post("/", verifyToken, quizController.createQuiz);

// Student & Instructor
router.get("/course/:courseId", verifyToken, quizController.getQuizzesByCourse);
router.post("/submit", verifyToken, quizController.submitQuizAttempt);

module.exports = router;
