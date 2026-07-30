// keeps folder/file paths inside the folder the user actually opened.
// stops someone passing ../../ and reading files outside the selected folder

const path = require("path");
const fs = require("fs");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".bmp", ".webp", ".gif"]);

function resolveFolder(folderPath) {
  if (!folderPath || typeof folderPath !== "string") {
    throw new Error("path is required");
  }
  const resolved = path.resolve(folderPath);

  if (!fs.existsSync(resolved)) {
    throw new Error("folder not found: " + folderPath);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error("not a directory: " + folderPath);
  }
  return resolved;
}

function safeJoin(folder, fileName) {
  const target = path.resolve(folder, fileName);
  if (!target.startsWith(folder + path.sep) && target !== folder) {
    throw new Error("invalid path, outside of session folder");
  }
  return target;
}

function isImageFile(fileName) {
  return IMAGE_EXT.has(path.extname(fileName).toLowerCase());
}

module.exports = { resolveFolder, safeJoin, isImageFile, IMAGE_EXT };
