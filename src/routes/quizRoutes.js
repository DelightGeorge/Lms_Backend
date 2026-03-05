// src/routes/quizRoutes.js
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  createQuiz, getQuizzesByCourse, submitQuizAttempt,
  deleteQuiz, getMyAttempts,
} = require("../controllers/quizController");

router.post("/",                    protect, createQuiz);
router.get("/course/:courseId",     protect, getQuizzesByCourse);
router.post("/submit",              protect, submitQuizAttempt);
router.delete("/:id",               protect, deleteQuiz);
router.get("/attempts/:courseId",   protect, getMyAttempts);

module.exports = router;