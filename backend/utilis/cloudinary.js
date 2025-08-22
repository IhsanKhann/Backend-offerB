// utils/cloudinary.js
import cloudinary from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();


cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadImageToCloudinary = async (file, folder = "employees") => {
  try {
    // file.path comes from multer disk storage
    const result = await cloudinary.v2.uploader.upload(file.path, {
      folder,
      resource_type: "image",
    });

    // remove file from local uploads folder
    fs.unlinkSync(file.path);

    return result;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    throw err;
  }
};

// Destroy image
export const destroyImageFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.v2.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result.result !== "ok") {
      console.warn("Cloudinary delete warning:", result);
    }

    return result;
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    throw err;
  }
};