// src/utils/notificationHelper.js
const prisma = require("../prisma");

/**
 * Central notification creator used across all controllers.
 * Always call this instead of prisma.notification.create directly.
 */
const notify = async ({ userId, title, message, type }) => {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type },
    });
  } catch (err) {
    // Never let notification failure crash the main request
    console.error("Notification error:", err.message);
  }
};

module.exports = { notify };
