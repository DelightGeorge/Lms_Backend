const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const { markComplete, getCourseProgress } = require("../controllers/progressController");

router.post("/complete", protect, markComplete);
router.get("/:courseId", protect, getCourseProgress);

module.exports = router;