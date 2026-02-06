const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const reviewController = require("../controllers/reviewController");

// Student routes
router.post("/", verifyToken, reviewController.createReview);
router.get("/course/:courseId", reviewController.getReviewsByCourse);

module.exports = router;
