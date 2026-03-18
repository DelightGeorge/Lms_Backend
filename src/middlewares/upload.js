const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "general";
    if (req.baseUrl.includes("courses"))      folder = "courses";
    else if (req.baseUrl.includes("lessons")) folder = "lessons";
    else if (req.baseUrl.includes("resources")) folder = "resources";
    else if (req.baseUrl.includes("users"))   folder = "avatars";
    else if (req.baseUrl.includes("instructor-applications")) folder = "lmspro/applications";

    // Determine resource type and format based on mimetype
    let resource_type = "image";
    let format = undefined;

    if (file.mimetype.startsWith("video/")) {
      resource_type = "video";
      format = "mp4";
    } else if (
      file.mimetype === "application/pdf" ||
      file.mimetype === "application/msword" ||
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.mimetype === "application/zip"
    ) {
      resource_type = "raw";
      format = undefined; // don't force a format for raw files
    } else if (file.mimetype.startsWith("image/")) {
      resource_type = "image";
      format = "jpg";
    }

    return { folder, resource_type, ...(format && { format }) };
  },
});

const upload = multer({ storage });

module.exports = upload;
