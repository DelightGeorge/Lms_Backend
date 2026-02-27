// src/routes/notificationRoutes.js
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

router.get("/",           protect, getUserNotifications);
router.get("/unread",     protect, getUnreadCount);
router.patch("/read-all", protect, markAllRead);
router.patch("/:id/read", protect, markOneRead);
router.delete("/all",     protect, deleteAll);
router.delete("/:id",     protect, deleteOne);

module.exports = router;
