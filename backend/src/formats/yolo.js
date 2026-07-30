// yolo format - one txt per image (normalized coords) + a shared classes.txt
// that lists class names in order, the line number = class index

const YOLO_CLASSES_FILENAME = "classes.txt";

function yoloFilenameFor(baseName) {
  return baseName + ".txt";
}

function buildClassesTxt(classes) {
  return classes.map((c) => c.name).join("\n");
}

function parseClassesTxt(text) {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

// classIndexOf: function that maps a classId -> its index in classes.txt
function buildYoloTxt(boxes, imgWidth, imgHeight, classIndexOf) {
  const lines = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const idx = classIndexOf(b.classId);
    if (idx === -1 || idx === undefined) continue; // skip if class somehow not found

    const cx = (b.x + b.w / 2) / imgWidth;
    const cy = (b.y + b.h / 2) / imgHeight;
    const w = b.w / imgWidth;
    const h = b.h / imgHeight;

    lines.push(idx + " " + cx.toFixed(6) + " " + cy.toFixed(6) + " " + w.toFixed(6) + " " + h.toFixed(6));
  }
  return lines.join("\n");
}

// returns boxes still in classIndex form (not classId yet) + pixel coords,
// caller maps classIndex -> classId using the classes list
function parseYoloTxt(text, imgWidth, imgHeight) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const parts = line.trim().split(/\s+/).map(Number);
    const classIndex = parts[0];
    const cx = parts[1];
    const cy = parts[2];
    const w = parts[3];
    const h = parts[4];

    const boxW = w * imgWidth;
    const boxH = h * imgHeight;
    const x = cx * imgWidth - boxW / 2;
    const y = cy * imgHeight - boxH / 2;

    return { classIndex, x, y, w: boxW, h: boxH };
  });
}

module.exports = { YOLO_CLASSES_FILENAME, yoloFilenameFor, buildClassesTxt, parseClassesTxt, buildYoloTxt, parseYoloTxt };
