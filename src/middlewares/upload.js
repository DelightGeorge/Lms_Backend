const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "general";
    if (req.baseUrl.includes("courses")) folder = "courses";
    else if (req.baseUrl.includes("lessons")) folder = "lessons";
    else if (req.baseUrl.includes("resources")) folder = "resources";
    else if (req.baseUrl.includes("users")) folder = "avatars";

    return {
      folder,
      format: file.mimetype.includes("video") ? "mp4" : "jpg",
      resource_type: file.mimetype.includes("video") ? "video" : "image",
    };
  },
});

const upload = multer({ storage });

module.exports = upload;
