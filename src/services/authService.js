// src/services/authService.js
import API from "../api";

// REGISTER
export const registerUser = (data) => API.post("/auth/register", data);

// LOGIN
export const loginUser = (data) => API.post("/auth/login", data);

// LOGOUT
export const logoutUser = () => localStorage.removeItem("token");
