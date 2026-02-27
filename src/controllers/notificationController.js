// src/controllers/notificationController.js
const prisma = require("../prisma");

// ===================== GET ALL NOTIFICATIONS =====================
// Does NOT auto-mark as read — user must explicitly mark them
exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where:   { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take:    100,
    });
    res.status(200).json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// ===================== GET UNREAD COUNT =====================
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, isRead: false },
    });
    res.status(200).json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
};

// ===================== MARK ONE AS READ =====================
exports.markOneRead = async (req, res) => {
  try {
    const notif = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    if (notif.userId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await prisma.notification.update({
      where: { id: req.params.id },
      data:  { isRead: true },
    });
    res.status(200).json({ message: "Marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

// ===================== MARK ALL AS READ =====================
exports.markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data:  { isRead: true },
    });
    res.status(200).json({ message: "All marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};

// ===================== DELETE ONE =====================
exports.deleteOne = async (req, res) => {
  try {
    const notif = await prisma.notification.findUnique({
      where: { id: req.params.id },
    });
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    if (notif.userId !== req.user.id) return res.status(403).json({ message: "Not allowed" });

    await prisma.notification.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete" });
  }
};

// ===================== DELETE ALL =====================
exports.deleteAll = async (req, res) => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user.id } });
    res.status(200).json({ message: "All notifications deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete all" });
  }
};
