// src/controllers/notificationController.js
const prisma = require("../prisma");

exports.getUserNotifications = async (req, res) => {
  try {
    // Fetch unread notifications first
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    // Mark all fetched notifications as read
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.status(200).json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};
