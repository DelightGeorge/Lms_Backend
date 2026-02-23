import API from "./api";

// ── Stats ──────────────────────────────────────────
export const getAdminStats = () => API.get("/admin/stats");

// ── Courses ────────────────────────────────────────
export const getPendingCourses = () => API.get("/admin/courses/pending");
export const getAllCourses = () => API.get("/courses");
export const reviewCourse = (courseId, data) =>
  API.patch(`/admin/courses/${courseId}/approve`, data);

// ── Users ──────────────────────────────────────────
export const getAllUsers = () => API.get("/admin/users");
export const deleteUser = (userId) => API.delete(`/admin/users/${userId}`);