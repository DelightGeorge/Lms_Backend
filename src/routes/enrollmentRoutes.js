const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");
const { enrollFree, checkEnrollment, getMyEnrollments } = require("../controllers/enrollmentController");

router.post("/free", protect, enrollFree);
router.get("/check/:courseId", protect, checkEnrollment);
router.get("/my", protect, getMyEnrollments);

module.exports = router;