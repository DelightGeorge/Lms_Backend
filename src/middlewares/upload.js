const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // ── Folder routing ───────────────────────────────────────────────────
    let folder = "general";
    if (req.baseUrl.includes("courses"))                    folder = "courses";
    else if (req.baseUrl.includes("lessons"))               folder = "lessons";
    else if (req.baseUrl.includes("resources"))             folder = "resources";
    else if (req.baseUrl.includes("users"))                 folder = "avatars";
    else if (req.baseUrl.includes("instructor-applications")) folder = "lmspro/applications";

    // ── Debug log ────────────────────────────────────────────────────────
    console.log("─────────────────────────────────────────");
    console.log("[Cloudinary Upload] File      :", file.originalname);
    console.log("[Cloudinary Upload] MIME type :", file.mimetype);
    console.log("[Cloudinary Upload] Folder    :", folder);

    // ── Resource type detection ──────────────────────────────────────────
    let resource_type = "image";
    let format        = undefined;

    if (file.mimetype.startsWith("video/")) {
      resource_type = "video";
      format        = "mp4";

    } else if (file.mimetype === "application/pdf") {
      // Cloudinary handles PDFs natively under the image endpoint
      resource_type = "image";
      format        = undefined;

    } else if (
      file.mimetype === "application/msword" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/zip"
    ) {
      resource_type = "raw";
      format        = undefined;

    } else if (
      // Fallback: some browsers send PDFs / unknown files as octet-stream
      file.mimetype === "application/octet-stream"
    ) {
      const ext = file.originalname.split(".").pop().toLowerCase();
      console.log("[Cloudinary Upload] octet-stream detected, extension:", ext);

      if (ext === "pdf") {
        resource_type = "image";
      } else if (["doc", "docx", "zip"].includes(ext)) {
        resource_type = "raw";
      } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
        resource_type = "image";
        format        = "jpg";
      } else {
        resource_type = "raw";
      }

    } else if (file.mimetype.startsWith("image/")) {
      resource_type = "image";
      format        = "jpg";
    }

    console.log("[Cloudinary Upload] resource_type:", resource_type);
    console.log("[Cloudinary Upload] format       :", format ?? "(none)");
    console.log("─────────────────────────────────────────");

    return {
      folder,
      resource_type,
      ...(format && { format }),
    };
  },
});

const upload = multer({ storage });

module.exports = upload;