// src/routes/reviewRoutes.js
const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/reviewController");
const protect = require("../middlewares/auth");

router.post("/",                    protect, ctrl.createReview);
router.get("/course/:courseId",             ctrl.getReviewsByCourse);   // public
router.get("/my/:courseId",         protect, ctrl.getMyReview);          // student's own review
router.delete("/:id",               protect, ctrl.deleteReview);

module.exports = router;
