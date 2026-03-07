// src/controllers/instructorApplicationController.js
const prisma      = require("../prisma");
const { notify }  = require("../utils/notificationHelper");

// ── helper: notify all admins ─────────────────────────────────────────────────
const notifyAllAdmins = async (payload) => {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(admins.map((a) => notify({ ...payload, userId: a.id })));
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/instructor-applications
// Body: { headline, expertise, yearsExperience, bio, idDocumentUrl, cvUrl,
//         portfolioUrl?, sampleVideoUrl?, teachingMotivation }
// Auth: any logged-in user (they want to become an instructor)
// ─────────────────────────────────────────────────────────────────────────────
exports.applyAsInstructor = async (req, res) => {
  try {
    const userId = req.user.id;

    // Block if already an approved instructor
    if (req.user.isInstructorApproved && req.user.role === "INSTRUCTOR") {
      return res.status(400).json({ message: "You are already an approved instructor." });
    }

    const {
      headline, expertise, yearsExperience, bio,
      idDocumentUrl, cvUrl, portfolioUrl, sampleVideoUrl,
      teachingMotivation,
    } = req.body;

    // Validate required fields
    const missing = [];
    if (!headline)            missing.push("headline");
    if (!expertise)           missing.push("expertise");
    if (!yearsExperience)     missing.push("yearsExperience");
    if (!bio)                 missing.push("bio");
    if (!idDocumentUrl)       missing.push("idDocumentUrl");
    if (!cvUrl)               missing.push("cvUrl");
    if (!teachingMotivation)  missing.push("teachingMotivation");
    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    // Upsert — allow re-submission if previously rejected
    const existing = await prisma.instructorApplication.findUnique({ where: { userId } });
    if (existing && existing.status === "PENDING") {
      return res.status(400).json({ message: "You already have a pending application. Please wait for admin review." });
    }
    if (existing && existing.status === "APPROVED") {
      return res.status(400).json({ message: "Your application is already approved." });
    }

    const application = await prisma.instructorApplication.upsert({
      where:  { userId },
      update: {
        headline, expertise,
        yearsExperience: Number(yearsExperience),
        bio, idDocumentUrl, cvUrl,
        portfolioUrl:      portfolioUrl      || null,
        sampleVideoUrl:    sampleVideoUrl    || null,
        teachingMotivation,
        status:            "PENDING",
        reviewedById:      null,
        reviewedAt:        null,
        rejectionReason:   null,
      },
      create: {
        userId, headline, expertise,
        yearsExperience: Number(yearsExperience),
        bio, idDocumentUrl, cvUrl,
        portfolioUrl:      portfolioUrl      || null,
        sampleVideoUrl:    sampleVideoUrl    || null,
        teachingMotivation,
      },
      include: { user: { select: { fullName: true, email: true } } },
    });

    // Confirm to applicant
    await notify({
      userId,
      title:   "📋 Application Received",
      message: "Your instructor application has been submitted. Our team will review it and notify you within 2–3 business days.",
      type:    "ACCOUNT",
    });

    // Notify all admins with full details
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { fullName: true, email: true, avatarUrl: true },
    });

    await notifyAllAdmins({
      title:   "🎓 New Instructor Application",
      message: [
        `${user.fullName} (${user.email}) has applied to become an instructor.`,
        `Headline: ${headline}`,
        `Expertise: ${expertise}`,
        `Experience: ${yearsExperience} year(s)`,
        `Motivation: ${teachingMotivation.substring(0, 200)}${teachingMotivation.length > 200 ? "..." : ""}`,
        `ID Document: ${idDocumentUrl}`,
        `CV/Resume: ${cvUrl}`,
        portfolioUrl    ? `Portfolio: ${portfolioUrl}` : null,
        sampleVideoUrl  ? `Sample Video: ${sampleVideoUrl}` : null,
      ].filter(Boolean).join("\n"),
      type: "INSTRUCTOR_APPLICATION",
    });

    res.status(201).json({ message: "Application submitted successfully", application });
  } catch (err) {
    console.error("applyAsInstructor error:", err);
    res.status(500).json({ message: "Failed to submit application" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/instructor-applications/my
// Returns the current user's own application
// ─────────────────────────────────────────────────────────────────────────────
exports.getMyApplication = async (req, res) => {
  try {
    const app = await prisma.instructorApplication.findUnique({
      where:   { userId: req.user.id },
      include: { reviewedBy: { select: { fullName: true } } },
    });
    res.status(200).json(app || null);
  } catch (err) {
    console.error("getMyApplication error:", err);
    res.status(500).json({ message: "Failed to fetch application" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/instructor-applications          (admin only)
// GET /api/instructor-applications?status=PENDING|APPROVED|REJECTED
// ─────────────────────────────────────────────────────────────────────────────
exports.getAllApplications = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });
    const { status } = req.query;
    const where = status ? { status } : {};
    const applications = await prisma.instructorApplication.findMany({
      where,
      include: {
        user:       { select: { id: true, fullName: true, email: true, avatarUrl: true, createdAt: true, role: true } },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(applications);
  } catch (err) {
    console.error("getAllApplications error:", err);
    res.status(500).json({ message: "Failed to fetch applications" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/instructor-applications/:id/review   (admin only)
// Body: { approve: bool, rejectionReason?: string }
// ─────────────────────────────────────────────────────────────────────────────
exports.reviewApplication = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });

    const { approve, rejectionReason } = req.body;
    const application = await prisma.instructorApplication.findUnique({
      where:   { id: req.params.id },
      include: { user: true },
    });
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (application.status !== "PENDING") {
      return res.status(400).json({ message: `Application already ${application.status.toLowerCase()}` });
    }

    // Update application status
    const updated = await prisma.instructorApplication.update({
      where: { id: req.params.id },
      data: {
        status:         approve ? "APPROVED" : "REJECTED",
        reviewedById:   req.user.id,
        reviewedAt:     new Date(),
        rejectionReason: approve ? null : (rejectionReason || "No reason provided"),
      },
    });

    if (approve) {
      // Promote user to INSTRUCTOR role and mark as approved
      await prisma.user.update({
        where: { id: application.userId },
        data: {
          role:                "INSTRUCTOR",
          isInstructorApproved: true,
          expertise:           application.expertise,
          yearsExperience:     application.yearsExperience,
          bio:                 application.bio,
        },
      });

      await notify({
        userId:  application.userId,
        title:   "🎉 Instructor Application Approved!",
        message: `Congratulations ${application.user.fullName}! Your instructor application has been approved. You can now create and publish courses on our platform. Welcome to the instructor team!`,
        type:    "INSTRUCTOR_APPROVED",
      });
    } else {
      await notify({
        userId:  application.userId,
        title:   "❌ Instructor Application Not Approved",
        message: `Hi ${application.user.fullName}, unfortunately your instructor application was not approved at this time. Reason: ${rejectionReason || "No reason provided"}. You're welcome to reapply after addressing the feedback.`,
        type:    "INSTRUCTOR_REJECTED",
      });
    }

    // Notify other admins
    const otherAdmins = await prisma.user.findMany({
      where: { role: "ADMIN", id: { not: req.user.id } },
      select: { id: true },
    });
    await Promise.all(otherAdmins.map((a) =>
      notify({
        userId:  a.id,
        title:   approve ? "✅ Instructor Application Approved" : "🚫 Instructor Application Rejected",
        message: `Admin ${req.user.fullName} ${approve ? "approved" : "rejected"} ${application.user.fullName}'s instructor application.`,
        type:    "ACCOUNT",
      })
    ));

    res.status(200).json({
      message: approve ? "Application approved — user is now an instructor" : "Application rejected",
      application: updated,
    });
  } catch (err) {
    console.error("reviewApplication error:", err);
    res.status(500).json({ message: "Failed to review application" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/instructor-applications/pending-count   (admin only)
// ─────────────────────────────────────────────────────────────────────────────
exports.getPendingCount = async (req, res) => {
  try {
    if (req.user.role !== "ADMIN") return res.status(403).json({ message: "Admins only" });
    const count = await prisma.instructorApplication.count({ where: { status: "PENDING" } });
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch count" });
  }
};
