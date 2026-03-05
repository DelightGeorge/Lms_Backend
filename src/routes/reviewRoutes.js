// src/routes/reviewRoutes.js
const express = require("express");
const router  = express.Router();
const protect = require("../middlewares/auth");
const { createReview, getReviewsByCourse, deleteReview } = require("../controllers/reviewController");

router.post("/",                  protect, createReview);
router.get("/course/:courseId",            getReviewsByCourse);
router.delete("/:id",             protect, deleteReview);

module.exports = router;
