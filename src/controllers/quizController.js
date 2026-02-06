const prisma = require("../prisma");

// ===================== CREATE QUIZ =====================
exports.createQuiz = async (req, res) => {
  try {
    const { courseId, title, questions } = req.body;

    if (!courseId || !title || !questions || !questions.length) {
      return res.status(400).json({ message: "Course, title, and questions are required" });
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ message: "Course not found" });

    if (req.user.role !== "INSTRUCTOR" || course.instructorId !== req.user.id) {
      return res.status(403).json({ message: "You cannot add quizzes to this course" });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        courseId,
        questions: {
          create: questions.map(q => ({
            text: q.text,
            options: { create: q.options },
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

// ===================== GET QUIZZES BY COURSE =====================
exports.getQuizzesByCourse = async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const quizzes = await prisma.quiz.findMany({
      where: { courseId },
      include: { questions: { include: { options: true } } },
    });

    res.status(200).json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch quizzes" });
  }
};

// ===================== SUBMIT QUIZ ATTEMPT =====================
exports.submitQuizAttempt = async (req, res) => {
  try {
    const { quizId, answers } = req.body; // answers = [{ questionId, optionId }]

    if (!quizId || !answers) return res.status(400).json({ message: "Quiz and answers required" });

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { options: true } } },
    });

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    // Calculate score
    let score = 0;
    answers.forEach(a => {
      const question = quiz.questions.find(q => q.id === a.questionId);
      if (!question) return;
      const option = question.options.find(o => o.id === a.optionId);
      if (option?.isCorrect) score++;
    });

    const attempt = await prisma.quizAttempt.create({
      data: { quizId, userId: req.user.id, score },
    });

    res.status(200).json({ message: "Quiz submitted", score, attempt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to submit quiz" });
  }
};
