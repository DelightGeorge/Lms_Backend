// src/services/categoryService.js
import API from "../api";

// GET ALL CATEGORIES
export const getAllCategories = () => API.get("/categories");

// CREATE CATEGORY (ADMIN)
export const createCategory = (data) => API.post("/categories", data);

// UPDATE CATEGORY (ADMIN)
export const updateCategory = (id, data) => API.patch(`/categories/${id}`, data);

// DELETE CATEGORY (ADMIN)
export const deleteCategory = (id) => API.delete(`/categories/${id}`);
