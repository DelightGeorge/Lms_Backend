import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

// Attach token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally — clear stale token and redirect to login
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes("/auth");
      if (!isAuthRoute) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // Only redirect if not already on auth page
        if (!window.location.pathname.includes("/auth")) {
          window.location.href = "/auth";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;