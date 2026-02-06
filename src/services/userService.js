// src/services/userService.js
import API from "../api";

// GET PROFILE
export const getProfile = () => API.get("/users/me");

// UPDATE PROFILE
export const updateProfile = (data) => API.patch("/users/me", data);

// CHANGE PASSWORD
export const changePassword = (data) => API.patch("/users/change-password", data);

// FORGOT PASSWORD
export const forgotPassword = (data) => API.post("/users/forgot-password", data);

// RESET PASSWORD
export const resetPassword = (token, data) =>
  API.patch(`/users/reset-password/${token}`, data);
