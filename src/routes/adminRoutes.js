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

router.get("/stats", protect, getStats);
router.get("/courses/pending", protect, getPendingCourses);
router.patch("/courses/:id/approve", protect, reviewCourse);
router.get("/users", protect, getAllUsers);
router.delete("/users/:id", protect, deleteUser);

module.exports = router;