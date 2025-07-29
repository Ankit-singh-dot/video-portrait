const express = require("express");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const app = express();
ffmpeg.setFfmpegPath(ffmpegPath);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));


const uploadDir = "/tmp/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});


app.post("/convert", upload.single("video"), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join(uploadDir, `output-${Date.now()}.mp4`);

  ffmpeg(inputPath)
    .videoCodec("libx264")
    .outputOptions([
      "-preset veryfast",
      "-tune film",
      "-vf",
      "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
      "-movflags +faststart",
    ])
    .audioCodec("aac")
    .save(outputPath)
    .on("end", () => {
      res.download(outputPath, () => {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on("error", (err) => {
      console.error("FFmpeg error:", err);
      res.status(500).send("Conversion failed");
    });
});


app.post("/convert-url", async (req, res) => {
  const { videoUrl } = req.body;
  if (!videoUrl) return res.status(400).send("Missing videoUrl");

  const inputPath = path.join(uploadDir, `input-${Date.now()}.mp4`);
  const outputPath = path.join(uploadDir, `output-${Date.now()}.mp4`);

  try {
    const response = await axios({
      url: videoUrl,
      method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      ffmpeg(inputPath)
        .videoCodec("libx264")
        .outputOptions([
          "-preset veryfast",
          "-tune film",
          "-vf",
          "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
          "-movflags +faststart",
        ])
        .audioCodec("aac")
        .save(outputPath)
        .on("end", () => {
          res.download(outputPath, () => {
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
          });
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          res.status(500).send("Conversion failed");
        });
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).send("Failed to download video");
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
