const express = require("express");
const router = express.Router();
const createCourse = require("../controllers/courseController").createCourse;
const upload = require("../middlewares/upload"); // multer middleware
const authMiddleware = require("../middlewares/authMiddleware");


// Instructor creates a course
router.post("/", authMiddleware(["INSTRUCTOR"]), upload.single("thumbnail"), createCourse);

module.exports = router;
