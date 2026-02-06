// src/services/notificationService.js
import API from "../api";

// GET ALL NOTIFICATIONS FOR LOGGED-IN USER
export const getNotifications = () => API.get("/notifications");

// MARK NOTIFICATION AS READ
export const markNotificationRead = (id) =>
  API.patch(`/notifications/${id}/read`);

// DELETE NOTIFICATION
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);
