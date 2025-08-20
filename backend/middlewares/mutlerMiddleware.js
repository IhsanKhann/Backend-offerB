// here mutler middleware which decides which file I must have in the request.
// basically req.files and req.file we get from here.

import multer from "multer";
import express from "express";
    const app = express();

    // Configure storage
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, './uploads/'); // Specify the directory to store uploaded files
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname); // Define the filename
        }
    });

    const upload = multer({ storage: storage });
    export default upload;
    // temporarily stores file in our db;