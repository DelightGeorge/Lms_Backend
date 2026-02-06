const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const verifyToken = require("../middlewares/auth");

router.get("/", verifyToken, cartController.getCart);
router.post("/", verifyToken, cartController.addToCart);
router.patch("/:itemId", verifyToken, cartController.updateCartItem);
router.delete("/:itemId", verifyToken, cartController.removeCartItem);
router.delete("/", verifyToken, cartController.clearCart);

module.exports = router;
