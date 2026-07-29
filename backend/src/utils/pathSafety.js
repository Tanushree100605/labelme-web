// helper functions to make sure we dont read/write files outside the folder
// the user actually picked. basically stops someone passing something like
// ../../ in the path and reading random files from the system

const path = require("path");
const fs = require("fs");

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".bmp", ".webp"];

function resolveFolder(folderPath) {
  if (!folderPath || typeof folderPath !== "string") {
    throw new Error("folder path is required");
  }

  const resolved = path.resolve(folderPath);

  if (!fs.existsSync(resolved)) {
    throw new Error("folder does not exist: " + resolved);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error("this is not a folder: " + resolved);
  }

  return resolved;
}

// joins folder + filename but checks the final path is still inside
// the folder, otherwise throws
function safeJoin(folder, fileName) {
  const resolvedFolder = resolveFolder(folder);
  const target = path.resolve(resolvedFolder, fileName);

  if (!target.startsWith(resolvedFolder + path.sep) && target !== resolvedFolder) {
    throw new Error("invalid file path, outside of selected folder");
  }

  return target;
}

function isImageFile(fileName) {
  return IMAGE_EXTENSIONS.includes(path.extname(fileName).toLowerCase());
}

module.exports = { resolveFolder, safeJoin, isImageFile, IMAGE_EXTENSIONS };
