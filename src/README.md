<div align="center">

# 📚 LMSPRO — Backend API

A production-ready Learning Management System backend built with Node.js, Express, Prisma ORM, and PostgreSQL. Supports students, instructors, and admins with payments, wallets, certificates, quizzes, coupons, and more.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-lmspro.vercel.app-blue?style=for-the-badge)](https://lms-frontend-phi-khaki.vercel.app/)
[![Backend](https://img.shields.io/badge/API-Render-green?style=for-the-badge)](https://lms-backend-4gx8.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

## 🔗 Links

| Resource | URL |
|---|---|
| 🌐 Frontend | https://lms-frontend-phi-khaki.vercel.app/ |
| 🚀 API Base URL | https://lms-backend-4gx8.onrender.com/api |
| 📦 Frontend Repo | https://github.com/DelightGeorge/Lms_Frontend |
| 📦 Backend Repo | https://github.com/DelightGeorge/Lms_Backend |

---

## 🏗 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL (Neon serverless) |
| ORM | Prisma |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Payments | Paystack |
| File Storage | Cloudinary |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Render (backend) · Vercel (frontend) |

---

## ✨ Features

- 🔐 **Auth** — Register, login, email verification, password reset, JWT sessions
- 👥 **Roles** — Student · Instructor · Admin with role-based access control
- 📚 **Courses** — Full CRUD, admin approval workflow, category filtering, search
- 📖 **Lessons** — Structured lesson flow per course with video & text support
- 🧾 **Enrollment** — Free and paid enrollment, access control
- 📊 **Progress** — Per-lesson completion tracking, overall progress percentage
- 🧠 **Quizzes** — Create quizzes, submit answers, track scores and attempts
- ⭐ **Reviews** — One review per enrolled user per course, average rating computed
- 🏅 **Certificates** — Auto-generated on 100% course completion
- 💳 **Payments** — Paystack integration with webhook verification
- 💰 **Wallet** — Instructor earnings, revenue split (37%/97%), payout requests
- 🎟 **Coupons** — Instructor-created discount codes with usage tracking
- 🔔 **Notifications** — In-app alerts for course events, read/unread tracking
- 🧑‍💼 **Admin** — Stats, analytics, user management, course moderation, payout approvals
- 📝 **Instructor Applications** — Document upload workflow with admin review

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL database (or [Neon](https://neon.tech) free tier)
- Cloudinary account (free tier)
- Paystack account

### 1. Clone the repository

```bash
git clone https://github.com/DelightGeorge/Lms_Backend.git
cd Lms_Backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root:

```env
# Server
PORT=5000

# Database
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Auth
JWT_SECRET="your_jwt_secret_here"

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_gmail_app_password

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
PAYSTACK_CALLBACK_URL=https://your-frontend.vercel.app/payment/callback

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
```

### 4. Set up the database

```bash
npx prisma generate
npx prisma db push
```

### 5. Run the server

```bash
# Development
npm run dev

# Production
npm start
```

Server runs at `http://localhost:5000`

---

## 📡 API Reference

All endpoints are prefixed with `/api`. Protected routes require:

```
Authorization: Bearer <jwt_token>
```

---

### 🔐 Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register a new user |
| POST | `/login` | ❌ | Login and receive JWT |
| GET | `/verify-email/:token` | ❌ | Verify email address |
| POST | `/resend-verification` | ❌ | Resend verification email |

**POST `/register`** — Request body:
```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123",
  "role": "STUDENT",
  "avatarUrl": "https://..." 
}
```

**POST `/login`** — Response:
```json
{
  "token": "eyJhbGci...",
  "user": {
    "id": "clx...",
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "role": "STUDENT",
    "avatarUrl": "https://...",
    "isEmailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 👤 Users — `/api/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | ✅ | Get current user profile |
| PATCH | `/me` | ✅ | Update profile (name, bio, phone, etc.) |
| PATCH | `/change-password` | ✅ | Change password |
| POST | `/forgot-password` | ❌ | Request password reset email |
| PATCH | `/reset-password/:token` | ❌ | Reset password with token |
| GET | `/instructors` | ❌ | List all approved instructors |
| GET | `/instructors/:id` | ❌ | Get instructor public profile |

---

### 📚 Courses — `/api/courses`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ❌ | List published courses (supports `?search=`, `?category=`, `?instructorId=`) |
| GET | `/:id` | ❌ | Get course details with lessons |
| POST | `/` | ✅ Instructor | Create a course |
| PATCH | `/:id` | ✅ Instructor | Update a course |
| DELETE | `/:id` | ✅ Instructor/Admin | Delete a course |
| PATCH | `/:id/submit` | ✅ Instructor | Submit course for admin review |
| GET | `/instructor/my-courses` | ✅ Instructor | Get instructor's own courses |

---

### 📖 Lessons — `/api/lessons`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `?courseId=:id` | ✅ Enrolled | Get lessons for a course |
| POST | `/` | ✅ Instructor | Create a lesson |
| PATCH | `/:id` | ✅ Instructor | Update a lesson |
| DELETE | `/:id` | ✅ Instructor | Delete a lesson |

---

### 🧾 Enrollments — `/api/enrollments`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/my` | ✅ Student | Get my enrolled courses with progress |
| POST | `/free` | ✅ Student | Enroll in a free course |
| GET | `/course/:courseId` | ✅ Instructor | Get students enrolled in a course |

---

### 📊 Progress — `/api/progress`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/complete` | ✅ Student | Mark a lesson as complete |
| GET | `/course/:courseId` | ✅ Student | Get progress for a course |

---

### 🧠 Quizzes — `/api/quizzes`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ Instructor | Create a quiz |
| GET | `/course/:courseId` | ✅ | Get quizzes for a course |
| POST | `/submit` | ✅ Student | Submit quiz answers |
| DELETE | `/:id` | ✅ Instructor | Delete a quiz |
| GET | `/attempts/:courseId` | ✅ Student | Get my quiz attempts |

---

### ⭐ Reviews — `/api/reviews`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ Enrolled | Submit or update a review |
| GET | `/course/:courseId` | ❌ | Get reviews for a course |
| DELETE | `/:id` | ✅ Owner/Admin | Delete a review |

---

### 💳 Payments — `/api/payments`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/initialize` | ✅ Student | Initialize Paystack payment |
| GET | `/verify/:ref` | ✅ | Verify payment by reference |
| POST | `/webhook` | ❌ | Paystack webhook (raw body required) |
| POST | `/enroll/free` | ✅ Student | Enroll in a free course |
| GET | `/history` | ✅ Student | Get payment history |

**POST `/initialize`** — Request body:
```json
{
  "courseId": "clx...",
  "couponCode": "SAVE20"
}
```

---

### 💰 Wallet — `/api/wallet`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | ✅ Instructor | Get wallet balance and earnings |
| POST | `/payout/request` | ✅ Instructor | Request a payout |
| GET | `/admin/payouts` | ✅ Admin | List all payout requests |
| PATCH | `/admin/payouts/:id/approve` | ✅ Admin | Approve a payout |
| PATCH | `/admin/payouts/:id/reject` | ✅ Admin | Reject a payout |

---

### 🎟 Coupons — `/api/coupons`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/mine` | ✅ Instructor | Get my coupons |
| POST | `/` | ✅ Instructor | Create a coupon |
| PATCH | `/:id` | ✅ Instructor | Update a coupon |
| DELETE | `/:id` | ✅ Instructor | Delete a coupon |
| GET | `/validate` | ❌ | Validate a coupon code (`?code=&courseId=`) |

---

### 🔔 Notifications — `/api/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Get all notifications |
| GET | `/unread` | ✅ | Get unread count |
| PATCH | `/:id/read` | ✅ | Mark notification as read |
| PATCH | `/read-all` | ✅ | Mark all as read |

---

### 🧑‍💼 Admin — `/api/admin`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stats` | ✅ Admin | Platform statistics |
| GET | `/analytics` | ✅ Admin | Monthly revenue and enrollment analytics |
| GET | `/courses/pending` | ✅ Admin | Courses awaiting review |
| GET | `/courses/all` | ✅ Admin | All courses |
| PATCH | `/courses/:id/review` | ✅ Admin | Approve or reject a course |
| GET | `/users` | ✅ Admin | All users |
| DELETE | `/users/:id` | ✅ Admin | Delete a user |

**PATCH `/courses/:id/review`** — Request body:
```json
{
  "approve": true,
  "rejectionReason": "Optional — required if approve is false"
}
```

---

### 📝 Instructor Applications — `/api/instructor-applications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/` | ✅ Instructor | Submit an application |
| GET | `/` | ✅ Admin | List all applications |
| PATCH | `/:id/review` | ✅ Admin | Approve or reject an application |

---

### 🏅 Certificates — `/api/certificates`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/:courseId` | ✅ Student | Get certificate for a completed course |

---

## 🔐 Revenue Split

| Sale Type | Instructor | Platform |
|---|---|---|
| Regular sale | 37% | 63% |
| Instructor referral (`?ref=` or coupon) | 97% | 3% |

Earnings are held for **30 days** before being released to the instructor's available balance.

---

## ⚠️ Error Responses

All errors return a consistent structure:

```json
{
  "message": "Human-readable error description"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Unauthenticated — missing or expired token |
| 403 | Forbidden — wrong role |
| 404 | Resource not found |
| 500 | Internal server error |

---

## 🗂 Project Structure

```
src/
├── controllers/       # Route handlers
│   ├── authController.js
│   ├── courseController.js
│   ├── enrollmentController.js
│   ├── paymentController.js
│   ├── walletController.js
│   └── ...
├── routes/            # Express routers
├── middlewares/       # Auth, role guards
├── services/          # Business logic (revenue, email)
├── utils/             # sendEmail, helpers
├── emails/            # HTML email templates
├── cron/              # Scheduled jobs (earnings release)
├── prisma.js          # Prisma client singleton
└── index.js           # App entry point
```

---

## 👨‍💻 Author

**Delight George**
- 📧 delightgeorge105@gmail.com
- 🌐 [lms-frontend-phi-khaki.vercel.app](https://lms-frontend-phi-khaki.vercel.app/)
- 🐙 [github.com/DelightGeorge](https://github.com/DelightGeorge)

---

<div align="center">
  Built with ❤️ by Delight George
</div>