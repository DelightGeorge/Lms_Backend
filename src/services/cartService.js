import API from "../api";

// GET CART
export const getCart = () => API.get("/cart");

// ADD TO CART
export const addToCart = (courseId, quantity = 1) =>
  API.post("/cart", { courseId, quantity });

// UPDATE CART ITEM
export const updateCartItemQuantity = (itemId, quantity) =>
  API.patch(`/cart/${itemId}`, { quantity });

// REMOVE CART ITEM
export const removeFromCart = (itemId) =>
  API.delete(`/cart/${itemId}`);

// CLEAR CART
export const clearCart = () => API.delete("/cart");
