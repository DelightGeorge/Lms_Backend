const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const {
  getStats, getAnalytics,
  getPendingCourses, getAllCourses, getCourseDetail,
  reviewCourse, editCourse, deleteCourse,
  getAllUsers, deleteUser,
} = require("../controllers/adminController");

router.get("/stats",                protect, getStats);
router.get("/analytics",            protect, getAnalytics);
router.get("/courses/pending",      protect, getPendingCourses);
router.get("/courses/all",          protect, getAllCourses);
router.get("/courses/:id",          protect, getCourseDetail);
router.patch("/courses/:id/review", protect, reviewCourse);
router.patch("/courses/:id/edit",   protect, editCourse);
router.delete("/courses/:id",       protect, deleteCourse);
router.get("/users",                protect, getAllUsers);
router.delete("/users/:id",         protect, deleteUser);

module.exports = router;