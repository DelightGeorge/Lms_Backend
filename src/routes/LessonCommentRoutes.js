// src/routes/lessonCommentRoutes.js
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const optionalAuth = require("../middlewares/optionalAuth"); // see note below
const {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
} = require("../controllers/lessonCommentController");

// GET comments — optionally authed (so we can track if user liked)
// If you don't have an optionalAuth middleware, just use protect here
router.get("/:lessonId",     optionalAuth, getComments);

// Requires login
router.post("/",             protect, createComment);
router.patch("/:id",         protect, updateComment);
router.delete("/:id",        protect, deleteComment);
router.post("/:id/like",     protect, toggleLike);

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO index.js:
// const lessonCommentRoutes = require("./routes/lessonCommentRoutes");
// app.use("/api/lesson-comments", lessonCommentRoutes);
//
// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL AUTH MIDDLEWARE — create src/middlewares/optionalAuth.js:
// ─────────────────────────────────────────────────────────────────────────────
// const jwt = require("jsonwebtoken");
// const prisma = require("../prisma");
// module.exports = async (req, res, next) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) { req.user = null; return next(); }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = await prisma.user.findUnique({ where: { id: decoded.id } });
//   } catch { req.user = null; }
//   next();
// };
// ─────────────────────────────────────────────────────────────────────────────
