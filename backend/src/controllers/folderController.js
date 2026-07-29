const fs = require("fs");
const path = require("path");
const { resolveFolder, safeJoin, isImageFile } = require("../utils/pathSafety");

// GET /api/folder/list?path=...
// returns all images in the folder + whether each one already has annotations
const listFolder = (req, res) => {
  try {
    const folderPath = req.query.path;
    const resolved = resolveFolder(folderPath);

    const allFiles = fs.readdirSync(resolved);
    const images = allFiles
      .filter(isImageFile)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((fileName) => {
        const base = path.parse(fileName).name;

        const hasCOCO = fs.existsSync(path.join(resolved, "annotations.json"));
        const hasVOC = fs.existsSync(path.join(resolved, base + ".xml"));
        const hasYOLO = fs.existsSync(path.join(resolved, base + ".txt"));

        return {
          fileName,
          url: "/api/folder/image?path=" + encodeURIComponent(resolved) + "&file=" + encodeURIComponent(fileName),
          annotated: hasCOCO || hasVOC || hasYOLO,
        };
      });

    // check if this folder already has a format chosen from before
    let detectedFormat = null;
    if (fs.existsSync(path.join(resolved, "annotations.json"))) detectedFormat = "coco";
    else if (allFiles.some((f) => f.endsWith(".xml"))) detectedFormat = "pascal_voc";
    else if (fs.existsSync(path.join(resolved, "classes.txt"))) detectedFormat = "yolo";

    res.json({
      success: true,
      folder: resolved,
      totalImages: images.length,
      detectedFormat,
      images,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/folder/image?path=...&file=...
// just streams the image back so frontend can put it in a canvas/img tag
const serveImage = (req, res) => {
  try {
    const folderPath = req.query.path;
    const file = req.query.file;
    const filePath = safeJoin(folderPath, file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "image not found" });
    }
    if (!isImageFile(file)) {
      return res.status(400).json({ success: false, message: "not a supported image type" });
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { listFolder, serveImage };
