const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });

ffmpeg.setFfmpegPath(ffmpegPath);

app.post("/convert", upload.single("video"), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = `output-${Date.now()}.mp4`;

  ffmpeg(inputPath)
    .outputOptions([
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1", 
      "-c:a copy",
    ])
    .save(outputPath)
    .on("end", () => {
      res.download(outputPath, () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    });
});

app.listen(3000, () => console.log("Server running on port 3000"));
