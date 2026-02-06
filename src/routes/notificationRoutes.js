const express = require("express");
const router = express.Router();
const protect = require("../middlewares/auth");

const { getUserNotifications } = require("../controllers/notificationController");

router.get("/notifications", protect, getUserNotifications);

module.exports = router;
