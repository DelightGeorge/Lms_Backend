const prisma = require("../prisma");

// ===================== GET USER CART =====================
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: { items: true },
      });
    }

    res.status(200).json(cart);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
};

// ===================== ADD ITEM TO CART =====================
exports.addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, quantity = 1 } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId } });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_courseId: {
          cartId: cart.id,
          courseId,
        },
      },
    });

    let item;
    if (existingItem) {
      item = await prisma.cartItem.update({
        where: {
          cartId_courseId: {
            cartId: cart.id,
            courseId,
          },
        },
        data: {
          quantity: existingItem.quantity + quantity,
        },
      });
    } else {
      item = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          courseId,
          quantity,
        },
      });
    }

    res.status(200).json({ message: "Item added to cart", item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add item to cart" });
  }
};

// ===================== UPDATE CART ITEM =====================
exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    if (quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    // Ensure item belongs to logged-in user
    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });

    res.status(200).json({ message: "Cart item updated", item: updatedItem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update cart item" });
  }
};

// ===================== REMOVE CART ITEM =====================
exports.removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
    });

    if (!item) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    await prisma.cartItem.delete({ where: { id: itemId } });

    res.status(200).json({ message: "Cart item removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove cart item" });
  }
};

// ===================== CLEAR CART =====================
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await prisma.cart.findUnique({ where: { userId } });

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    res.status(200).json({ message: "Cart cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to clear cart" });
  }
};
