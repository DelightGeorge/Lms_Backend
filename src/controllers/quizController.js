// src/controllers/quizController.js
const prisma = require("../prisma");

exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, questions } = req.body;
    if (!courseId || !title || !questions?.length) {
      return res.status(400).json({ message: "Course, title, and questions are required" });
    }
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (req.user.role !== "INSTRUCTOR" && req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Instructors only" });
    }
    if (req.user.role === "INSTRUCTOR" && course.instructorId !== req.user.id) {
      return res.status(403).json({ message: "Not your course" });
    }
    const quiz = await prisma.quiz.create({
      data: {
        title,
        courseId,
        questions: {
          create: questions.map((q) => ({
            text:    q.text,
            options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
          })),
        },
      },
      include: { questions: { include: { options: true } } },
    });
    res.status(201).json({ message: "Quiz created", quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create quiz" });
  }
};

exports.getQuizzesByCourse = async (req, res) => {
  try {
    const isInstructor = req.user.role === "INSTRUCTOR" || req.user.role === "ADMIN";
    const quizzes = await prisma.quiz.findMany({
      where: { courseId: req.params.courseId },
      include: {
        questions: {
          include: {
            options: {
              select: {
                id:        true,
                text:      true,
                isCorrect: isInstructor, // hide correct answers from students
              },
            },
          },
        },
        _count: { select: { quizAttempts: true } },
      },
    });
    res.status(200).json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
};

exports.submitQuizAttempt = async (req, res) => {
  try {
    const { quizId, answers } = req.body;
    if (!quizId || !answers) return res.status(400).json({ message: "Quiz and answers required" });

    const quiz = await prisma.quiz.findUnique({
      where:   { id: quizId },
      include: { questions: { include: { options: true } } },
    });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    let score = 0;
    const results = answers.map((a) => {
      const question = quiz.questions.find((q) => q.id === a.questionId);
      if (!question) return { questionId: a.questionId, correct: false };
      const chosen  = question.options.find((o) => o.id === a.optionId);
      const correct = question.options.find((o) => o.isCorrect);
      const isRight = chosen?.isCorrect || false;
      if (isRight) score++;
      return {
        questionId:      a.questionId,
        chosenOptionId:  a.optionId,
        correctOptionId: correct?.id,
        correct:         isRight,
      };
    });

    const pct = Math.round((score / quiz.questions.length) * 100);

    const attempt = await prisma.quizAttempt.create({
      data: { quizId, userId: req.user.id, score },
    });

    res.status(200).json({
      message: "Quiz submitted",
      score,
      total:   quiz.questions.length,
      percentage: pct,
      passed:  pct >= 70,
      results,
      attempt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit quiz" });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where:   { id: req.params.id },
      include: { course: true },
    });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (req.user.role === "INSTRUCTOR" && quiz.course.instructorId !== req.user.id) {
      return res.status(403).json({ message: "Not your course" });
    }
    await prisma.quiz.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Quiz deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete quiz" });
  }
};

exports.getMyAttempts = async (req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      where: { courseId: req.params.courseId },
      select: { id: true },
    });
    const quizIds = quizzes.map((q) => q.id);
    const attempts = await prisma.quizAttempt.findMany({
      where:   { userId: req.user.id, quizId: { in: quizIds } },
      include: { quiz: { select: { id: true, title: true, questions: { select: { id: true } } } } },
      orderBy: { attemptedAt: "desc" },
    });
    res.status(200).json(attempts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch attempts" });
  }
};
