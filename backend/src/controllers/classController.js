const fs = require("fs");
const path = require("path");
const { getSession } = require("../utils/sessionStore");
const coco = require("../formats/coco");
const yolo = require("../formats/yolo");

// PUT /api/folders/:sessionId/classes
// replaces the whole class list. for yolo this also rewrites classes.txt
// right away so the class order is locked in before any boxes reference it
const saveClasses = (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ message: "unknown session" });

  const classes = req.body.classes;
  if (!Array.isArray(classes)) {
    return res.status(400).json({ message: "classes must be an array" });
  }

  session.classes = classes.map((c) => ({ id: c.id, name: c.name }));

  try {
    if (session.format === "yolo") {
      const classesPath = path.join(session.dirPath, yolo.YOLO_CLASSES_FILENAME);
      fs.writeFileSync(classesPath, yolo.buildClassesTxt(session.classes));
    }
    if (session.format === "coco") {
      // coco keeps categories inside annotations.json itself, so just rewrite it
      const jsonPath = path.join(session.dirPath, coco.COCO_FILENAME);
      const doc = coco.buildCoco(session);
      fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2));
    }
    // voc doesnt need anything here - class names get written per-image
    // when annotations are saved, theres no separate class registry file

    res.json({ ok: true });
  } catch (err) {
    console.log("save classes failed:", err.message);
    res.status(500).json({ message: "could not save classes" });
  }
};

module.exports = { saveClasses };
