const fs = require("fs");
const path = require("path");
const { resolveFolder } = require("../utils/pathSafety");

const VALID_FORMATS = ["coco", "pascal_voc", "yolo"];

// checks if a format was already picked for this folder before
// (from a previous session) - used so we dont show the format picker again
const getFolderFormat = (req, res) => {
  try {
    const resolvedFolder = resolveFolder(req.query.path);
    const markerPath = path.join(resolvedFolder, ".labelme_format");

    if (!fs.existsSync(markerPath)) {
      return res.json({ success: true, locked: false, format: null });
    }

    const format = fs.readFileSync(markerPath, "utf-8").trim();
    res.json({ success: true, locked: true, format });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// removes the format lock, in case someone picked wrong format by mistake
// doesnt touch the actual annotation files, only removes the lock
const resetFolderFormat = (req, res) => {
  try {
    const folderPath = req.body.folderPath;
    const resolvedFolder = resolveFolder(folderPath);
    const markerPath = path.join(resolvedFolder, ".labelme_format");

    if (fs.existsSync(markerPath)) {
      fs.unlinkSync(markerPath);
    }

    res.json({ success: true, message: "format lock removed for this folder" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { getFolderFormat, resetFolderFormat, VALID_FORMATS };
