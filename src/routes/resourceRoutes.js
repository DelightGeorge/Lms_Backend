const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/auth");
const resourceController = require("../controllers/resourceController");

// Instructor routes
router.post("/", verifyToken, resourceController.addResource);
router.get("/course/:courseId", resourceController.getResourcesByCourse);

module.exports = router;
