// src/services/quizService.js
import API from "../api";

// CREATE QUIZ
export const createQuiz = (data) => API.post("/quizzes", data);

// GET QUIZ BY ID
export const getQuizById = (id) => API.get(`/quizzes/${id}`);

// SUBMIT QUIZ ATTEMPT
export const submitQuizAttempt = (id, data) =>
  API.post(`/quizzes/${id}/attempts`, data);
