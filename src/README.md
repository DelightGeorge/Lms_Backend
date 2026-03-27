# 📚 LMS Backend API

A full-featured Learning Management System (LMS) backend built with Node.js, Express, Prisma, and PostgreSQL. This system supports students, instructors, and administrators with advanced features like payments, wallets, quizzes, and analytics.

---

# 🚀 Live Demo (Frontend)
https://lms-frontend-phi-khaki.vercel.app/

---

# 🏗 Tech Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Authentication:** JWT
- **Payments:** Paystack
- **Deployment:** Vercel (Frontend)

---

# 🔐 Authentication

- User registration and login
- Email verification system
- JWT-based authentication
- Password reset with secure token system

---

# 👥 User Roles

- **Student**
- **Instructor**
- **Admin**

---

# ✨ Features

## 📚 Course Management
- Create, update, delete courses
- Course approval system (Admin)
- Publish/unpublish courses
- Instructor-specific course ownership

---

## 📖 Lessons
- Add lessons to courses
- Structured learning flow

---

## 🧾 Enrollment
- Free and paid enrollment
- Access control for enrolled users

---

## 📊 Progress Tracking
- Track completed lessons
- Monitor course progress

---

## 🧠 Quiz System
- Create quizzes
- Submit answers
- Track scores and attempts

---

## ⭐ Reviews
- Students can review courses
- One review per user per course

---

## 💳 Payments (Paystack)
- Payment initialization
- Payment verification
- Secure transaction handling

---

## 💰 Wallet System
- Instructor earnings tracking
- Payout requests
- Admin payout approval

---

## 🎟 Coupons
- Instructor-created discount codes
- Validation and usage tracking

---

## 🔔 Notifications
- Course approval/rejection alerts
- System notifications
- Read/unread tracking

---

## 🧑‍💼 Admin Dashboard
- Platform statistics
- Monthly analytics
- User management
- Course moderation

---

# 📡 API ENDPOINTS

## 🔐 Auth

### Register
POST `/api/auth/register`

### Login
POST `/api/auth/login`

### Verify Email
POST `/api/auth/verify-email`

### Forgot Password
POST `/api/auth/forgot-password`

### Reset Password
POST `/api/auth/reset-password`

---

## 📚 Courses

### Get All Courses
GET `/api/courses`

### Create Course (Instructor)
POST `/api/courses`

### Update Course
PUT `/api/courses/:id`

### Approve Course (Admin)
PATCH `/api/courses/:id/approve`

---

## 🧾 Enrollment

### Enroll in Course
POST `/api/enrollments`

### Get My Courses
GET `/api/enrollments/my-courses`

---

## 🧠 Quiz

### Submit Quiz
POST `/api/quiz/submit`

---

## 💳 Payments

### Initialize Payment
POST `/api/payments/initialize`

### Verify Payment
GET `/api/payments/verify`

---

## 💰 Wallet

### Request Payout
POST `/api/wallet/request-payout`

---

## 🔔 Notifications

### Get Notifications
GET `/api/notifications`

---

# ⚠️ Error Handling

All errors return a consistent JSON format:

```json
{
  "message": "Error message"
}

📈 Future Improvements
Role-based middleware refinement
Global error handling middleware
Rate limiting and security headers
Cart system (optional improvement)
API documentation with Swagger

👨‍💻 Author
Delight George
