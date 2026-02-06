// src/services/courseService.js
import API from "../api";

// CREATE COURSE
export const createCourse = (data) => API.post("/courses", data);

// UPDATE COURSE
export const updateCourse = (id, data) => API.patch(`/courses/${id}`, data);

// APPROVE / REJECT COURSE (ADMIN)
export const approveCourse = (id, data) =>
  API.patch(`/admin/courses/${id}/approve`, data);

// GET ALL COURSES
export const getAllCourses = () => API.get("/courses");

// GET COURSE BY ID
export const getCourseById = (id) => API.get(`/courses/${id}`);
