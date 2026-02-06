const express = require("express");
const router = express.Router();
const { createCategory, getCategories } = require("../controllers/categoryController");
const protect = require("../middlewares/auth");

// Only admins can create categories (optional: you can add role check later)
router.post("/", protect, createCategory);
router.get("/", getCategories);

module.exports = router;
