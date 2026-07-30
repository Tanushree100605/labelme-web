const fs = require("fs");
const path = require("path");
const { getSession } = require("../utils/sessionStore");
const coco = require("../formats/coco");
const voc = require("../formats/voc");
const yolo = require("../formats/yolo");

function baseName(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

// PUT /api/folders/:sessionId/annotations/:imageName
// replaces all boxes for one image, writes it to disk in whatever format
// the session was opened with
const saveAnnotationsForImage = (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ message: "unknown session" });

  const imageName = decodeURIComponent(req.params.imageName);
  const img = session.images.find((i) => i.name === imageName);
  if (!img) return res.status(404).json({ message: "image not found: " + imageName });

  const boxes = req.body.boxes;
  if (!Array.isArray(boxes)) {
    return res.status(400).json({ message: "boxes must be an array" });
  }

  // every box has to reference a class that was already saved via
  // PUT .../classes - otherwise we'd end up writing an annotation file
  // that points at nothing
  const validClassIds = new Set(session.classes.map((c) => c.id));
  const hasBadBox = boxes.some((b) => !validClassIds.has(b.classId));
  if (hasBadBox) {
    return res.status(422).json({ message: "one or more boxes reference an unknown classId" });
  }

  session.annotations[imageName] = boxes.map((b) => ({
    id: b.id,
    classId: b.classId,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
  }));

  try {
    if (session.format === "coco") {
      const jsonPath = path.join(session.dirPath, coco.COCO_FILENAME);
      const doc = coco.buildCoco(session);
      fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2));
    } else if (session.format === "yolo") {
      // class index in the txt file = position in session.classes array,
      // NOT the classId itself, so we build a lookup from id -> index
      const classIds = session.classes.map((c) => c.id);
      const txt = yolo.buildYoloTxt(session.annotations[imageName], img.width, img.height, (id) => classIds.indexOf(id));
      const txtPath = path.join(session.dirPath, yolo.yoloFilenameFor(baseName(imageName)));
      fs.writeFileSync(txtPath, txt);
    } else if (session.format === "voc") {
      const xml = voc.buildVocXml({
        imageName: imageName,
        folderName: session.folderName,
        width: img.width,
        height: img.height,
        boxes: session.annotations[imageName],
        classNameOf: (id) => {
          const cls = session.classes.find((c) => c.id === id);
          return cls ? cls.name : undefined;
        },
      });
      const xmlPath = path.join(session.dirPath, voc.vocFilenameFor(baseName(imageName)));
      fs.writeFileSync(xmlPath, xml);
    }

    res.json({ ok: true });
  } catch (err) {
    console.log("save annotation failed:", err.message);
    res.status(500).json({ message: "could not save annotation to disk" });
  }
};

module.exports = { saveAnnotationsForImage };
