// src/routes/notificationRoutes.js
// NOTE: This file is mounted at /api/notifications in index.js
// So routes here must start with / NOT /notifications

const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const {
  getUserNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteOne,
  deleteAll,
} = require("../controllers/notificationController");

router.get("/",           protect, getUserNotifications);  // GET  /api/notifications
router.get("/unread",     protect, getUnreadCount);        // GET  /api/notifications/unread
router.patch("/read-all", protect, markAllRead);           // PATCH /api/notifications/read-all
router.patch("/:id/read", protect, markOneRead);           // PATCH /api/notifications/:id/read
router.delete("/all",     protect, deleteAll);             // DELETE /api/notifications/all
router.delete("/:id",     protect, deleteOne);             // DELETE /api/notifications/:id

module.exports = router;