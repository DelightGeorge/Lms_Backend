// src/services/reviewService.js
import API from "../api";

// ADD REVIEW
export const addReview = (data) => API.post("/reviews", data);

// GET REVIEWS FOR COURSE
export const getReviewsByCourse = (courseId) =>
  API.get(`/reviews/course/${courseId}`);
