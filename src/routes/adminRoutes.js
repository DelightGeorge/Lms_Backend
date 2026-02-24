const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const {
  getPendingCourses,
  reviewCourse,
  getStats,
  getAllUsers,
  deleteUser,
} = require("../controllers/adminController");
const { getAllCourses } = require("../controllers/courseController"); // ← import from courseController

router.get("/stats", protect, getStats);
router.get("/courses/pending", protect, getPendingCourses);
router.get("/courses/all", protect, getAllCourses);           // ← add this
router.patch("/courses/:id/approve", protect, reviewCourse);
router.get("/users", protect, getAllUsers);
router.delete("/users/:id", protect, deleteUser);

module.exports = router;