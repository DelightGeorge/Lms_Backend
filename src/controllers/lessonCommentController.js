// src/controllers/lessonCommentController.js
const prisma     = require("../prisma");
const { notify } = require("../utils/notificationHelper");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/lesson-comments/:lessonId
// Public — returns all top-level comments + replies for a lesson
// ─────────────────────────────────────────────────────────────────────────────
exports.getComments = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const comments = await prisma.lessonComment.findMany({
      where:   { lessonId, parentId: null }, // top-level only
      include: {
        user:    { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        replies: {
          include: {
            user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { replies: true, likes: true } },
        likes:  req.user ? { where: { userId: req.user.id } } : false,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(comments);
  } catch (err) {
    console.error("getComments:", err);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lesson-comments
// Body: { lessonId, content, parentId? }
// Auth: enrolled student, course instructor, or admin
// ─────────────────────────────────────────────────────────────────────────────
exports.createComment = async (req, res) => {
  try {
    const userId              = req.user.id;
    const { lessonId, content, parentId } = req.body;

    if (!lessonId || !content?.trim()) {
      return res.status(400).json({ message: "lessonId and content are required" });
    }
    if (content.trim().length < 2) {
      return res.status(400).json({ message: "Comment is too short" });
    }
    if (content.length > 2000) {
      return res.status(400).json({ message: "Comment exceeds 2000 characters" });
    }

    // Get lesson + course
    const lesson = await prisma.lesson.findUnique({
      where:   { id: lessonId },
      include: { course: { select: { id: true, instructorId: true, title: true } } },
    });
    if (!lesson) return res.status(404).json({ message: "Lesson not found" });

    const courseId = lesson.course.id;
    const role     = req.user.role;

    // Access check: must be enrolled, be the instructor, or be an admin
    if (role === "STUDENT") {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!enrollment) {
        return res.status(403).json({ message: "You must be enrolled to comment" });
      }
    } else if (role === "INSTRUCTOR" && lesson.course.instructorId !== userId) {
      return res.status(403).json({ message: "You are not the instructor of this course" });
    }

    // If this is a reply, verify parentId belongs to same lesson
    if (parentId) {
      const parent = await prisma.lessonComment.findUnique({ where: { id: parentId } });
      if (!parent || parent.lessonId !== lessonId) {
        return res.status(400).json({ message: "Invalid parent comment" });
      }
    }

    const comment = await prisma.lessonComment.create({
      data: { userId, lessonId, content: content.trim(), parentId: parentId || null },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
    });

    // ── Notify instructor when a student comments ──────────────────────────
    if (role === "STUDENT" && lesson.course.instructorId) {
      await notify({
        userId:  lesson.course.instructorId,
        title:   "💬 New Question on Your Lesson",
        message: `${req.user.fullName || "A student"} commented on "${lesson.title}" in "${lesson.course.title}": "${content.substring(0, 100)}..."`,
        type:    "GENERAL",
      });
    }

    // ── Notify parent comment author if this is a reply ────────────────────
    if (parentId) {
      const parent = await prisma.lessonComment.findUnique({
        where:  { id: parentId },
        select: { userId: true, user: { select: { fullName: true } } },
      });
      if (parent && parent.userId !== userId) {
        await notify({
          userId:  parent.userId,
          title:   "↩️ Reply to Your Comment",
          message: `${req.user.fullName || "Someone"} replied to your comment on "${lesson.title}": "${content.substring(0, 100)}"`,
          type:    "GENERAL",
        });
      }
    }

    res.status(201).json({ message: "Comment posted", comment });
  } catch (err) {
    console.error("createComment:", err);
    res.status(500).json({ message: "Failed to post comment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/lesson-comments/:id
// Body: { content }
// Auth: comment owner only
// ─────────────────────────────────────────────────────────────────────────────
exports.updateComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ message: "Content required" });

    const existing = await prisma.lessonComment.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Comment not found" });
    if (existing.userId !== req.user.id) return res.status(403).json({ message: "Not your comment" });

    const updated = await prisma.lessonComment.update({
      where: { id: req.params.id },
      data:  { content: content.trim(), isEdited: true },
      include: { user: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
    });

    res.status(200).json({ message: "Comment updated", comment: updated });
  } catch (err) {
    console.error("updateComment:", err);
    res.status(500).json({ message: "Failed to update comment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/lesson-comments/:id
// Auth: owner or admin
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteComment = async (req, res) => {
  try {
    const comment = await prisma.lessonComment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const isOwner = comment.userId === req.user.id;
    const isAdmin = req.user.role === "ADMIN";
    if (!isOwner && !isAdmin) return res.status(403).json({ message: "Not allowed" });

    // Delete likes first, then replies, then the comment
    await prisma.lessonCommentLike.deleteMany({ where: { comment: { parentId: req.params.id } } });
    await prisma.lessonCommentLike.deleteMany({ where: { commentId: req.params.id } });
    await prisma.lessonComment.deleteMany({ where: { parentId: req.params.id } });
    await prisma.lessonComment.delete({ where: { id: req.params.id } });

    res.status(200).json({ message: "Comment deleted" });
  } catch (err) {
    console.error("deleteComment:", err);
    res.status(500).json({ message: "Failed to delete comment" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/lesson-comments/:id/like
// Toggle like on a comment
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleLike = async (req, res) => {
  try {
    const userId    = req.user.id;
    const commentId = req.params.id;

    const existing = await prisma.lessonCommentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await prisma.lessonCommentLike.delete({ where: { userId_commentId: { userId, commentId } } });
      res.status(200).json({ liked: false });
    } else {
      await prisma.lessonCommentLike.create({ data: { userId, commentId } });
      res.status(200).json({ liked: true });
    }
  } catch (err) {
    console.error("toggleLike:", err);
    res.status(500).json({ message: "Failed to toggle like" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA ADDITIONS NEEDED (add to schema.prisma):
// ─────────────────────────────────────────────────────────────────────────────
//
// model LessonComment {
//   id       String  @id @default(uuid())
//   content  String
//   isEdited Boolean @default(false)
//
//   userId   String
//   lessonId String
//   parentId String?
//
//   user    User    @relation("UserComments",  fields: [userId],   references: [id], onDelete: Cascade)
//   lesson  Lesson  @relation(fields: [lessonId], references: [id], onDelete: Cascade)
//   parent  LessonComment?  @relation("Replies", fields: [parentId], references: [id], onDelete: Cascade)
//   replies LessonComment[] @relation("Replies")
//   likes   LessonCommentLike[]
//
//   createdAt DateTime @default(now())
//   updatedAt DateTime @updatedAt
// }
//
// model LessonCommentLike {
//   userId    String
//   commentId String
//   user      User          @relation(fields: [userId],    references: [id], onDelete: Cascade)
//   comment   LessonComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
//   createdAt DateTime @default(now())
//   @@unique([userId, commentId])
// }
//
// On User model add:
//   lessonComments     LessonComment[]     @relation("UserComments")
//   lessonCommentLikes LessonCommentLike[]
//
// On Lesson model add:
//   comments LessonComment[]
//
// Run: npx prisma migrate dev --name lesson_comments
// ─────────────────────────────────────────────────────────────────────────────
