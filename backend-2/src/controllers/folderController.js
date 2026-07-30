const fs = require("fs");
const path = require("path");
const sizeOf = require("image-size");
const { resolveFolder, safeJoin, isImageFile } = require("../utils/pathSafety");
const { createSession, getSession, nextClassId, bumpClassIdCounter } = require("../utils/sessionStore");
const coco = require("../formats/coco");
const voc = require("../formats/voc");
const yolo = require("../formats/yolo");

const VALID_FORMATS = ["coco", "voc", "yolo"];

function baseName(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

// finds/creates a class by name and returns its id, used when resuming
// from an existing voc/yolo folder that only stores class NAMES not ids
function ensureClassByName(session, name) {
  const existing = session.classes.find((c) => c.name === name);
  if (existing) return existing.id;
  const id = nextClassId();
  session.classes.push({ id, name });
  return id;
}

// checks for existing annotation files matching the format and loads them
// into the session so the user can resume previous work on this folder
function loadExistingAnnotations(session) {
  if (session.format === "coco") {
    const jsonPath = path.join(session.dirPath, coco.COCO_FILENAME);
    if (!fs.existsSync(jsonPath)) return;
    try {
      const json = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const result = coco.parseCoco(json);
      result.classes.forEach((c) => {
        if (!session.classes.some((x) => x.id === c.id)) session.classes.push(c);
        bumpClassIdCounter(c.id);
      });
      session.annotations = result.annotationsByImage;
    } catch (err) {
      console.log("couldnt parse existing annotations.json:", err.message);
    }
    return;
  }

  if (session.format === "yolo") {
    const classesPath = path.join(session.dirPath, yolo.YOLO_CLASSES_FILENAME);
    let names = [];
    if (fs.existsSync(classesPath)) {
      names = yolo.parseClassesTxt(fs.readFileSync(classesPath, "utf-8"));
    }
    const idForIndex = names.map((n) => ensureClassByName(session, n));

    session.images.forEach((img) => {
      const txtPath = path.join(session.dirPath, yolo.yoloFilenameFor(baseName(img.name)));
      if (!fs.existsSync(txtPath)) return;
      const parsed = yolo.parseYoloTxt(fs.readFileSync(txtPath, "utf-8"), img.width, img.height);
      session.annotations[img.name] = parsed.map((b) => ({
        classId: idForIndex[b.classIndex] !== undefined ? idForIndex[b.classIndex] : ensureClassByName(session, "class_" + b.classIndex),
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
      }));
    });
    return;
  }

  if (session.format === "voc") {
    session.images.forEach((img) => {
      const xmlPath = path.join(session.dirPath, voc.vocFilenameFor(baseName(img.name)));
      if (!fs.existsSync(xmlPath)) return;
      const parsed = voc.parseVocXml(fs.readFileSync(xmlPath, "utf-8"));
      session.annotations[img.name] = parsed.boxes.map((b) => ({
        classId: ensureClassByName(session, b.className),
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
      }));
    });
  }
}

// POST /api/folders/open
const openFolder = (req, res) => {
  try {
    const folderPath = req.body.path;
    const format = req.body.format;

    if (!folderPath || !VALID_FORMATS.includes(format)) {
      return res.status(400).json({ message: "path and a valid format are required" });
    }

    let resolved;
    try {
      resolved = resolveFolder(folderPath);
    } catch (err) {
      return res.status(404).json({ message: err.message });
    }

    const entries = fs.readdirSync(resolved);
    const imageNames = entries
      .filter(isImageFile)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const images = imageNames.map((name) => {
      try {
        const buf = fs.readFileSync(path.join(resolved, name));
        const dims = sizeOf(buf);
        return { name, width: dims.width || 0, height: dims.height || 0 };
      } catch (err) {
        return { name, width: 0, height: 0 };
      }
    });

    // sessionId is just the folder path base64 encoded - simple and means
    // reopening the same folder gives back the same session id every time
    const sessionId = Buffer.from(resolved).toString("base64url");

    const session = {
      dirPath: resolved,
      folderName: path.basename(resolved),
      format,
      classes: [],
      images,
      annotations: {},
    };

    loadExistingAnnotations(session);
    createSession(sessionId, session);

    res.json({
      sessionId,
      folderName: session.folderName,
      format: session.format,
      images: session.images,
      classes: session.classes,
      annotations: session.annotations,
    });
  } catch (err) {
    console.log("open folder failed:", err.message);
    res.status(500).json({ message: "something went wrong opening the folder" });
  }
};

// GET /api/folders/:sessionId/images/:imageName/file
const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const serveImageFile = (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ message: "unknown session" });

  const imageName = decodeURIComponent(req.params.imageName);
  if (!session.images.some((i) => i.name === imageName)) {
    return res.status(404).json({ message: "image not found: " + imageName });
  }

  try {
    const filePath = safeJoin(session.dirPath, imageName);
    const ext = path.extname(imageName).toLowerCase();
    res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
    res.sendFile(filePath);
  } catch (err) {
    res.status(404).json({ message: "could not read image: " + imageName });
  }
};

module.exports = { openFolder, serveImageFile };
