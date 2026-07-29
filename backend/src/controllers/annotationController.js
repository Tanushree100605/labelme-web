const fs = require("fs");
const path = require("path");
const { safeJoin, resolveFolder } = require("../utils/pathSafety");
const { toCOCO, toPascalVOC, toYOLO } = require("../utils/formatConverters");

const VALID_FORMATS = ["coco", "pascal_voc", "yolo"];

// POST /api/annotations/save
// body: { folderPath, format, imageName, imageWidth, imageHeight, annotations }
// writes the annotation file straight into the images folder depending on format:
//   coco -> shared annotations.json for the whole folder
//   pascal_voc -> one xml per image
//   yolo -> one txt per image + a shared classes.txt
const saveAnnotation = (req, res) => {
  try {
    const { folderPath, format, imageName, imageWidth, imageHeight, annotations } = req.body;

    if (!folderPath || !format || !imageName) {
      return res.status(400).json({ success: false, message: "folderPath, format and imageName are required" });
    }
    if (!VALID_FORMATS.includes(format)) {
      return res.status(400).json({ success: false, message: "format must be one of: " + VALID_FORMATS.join(", ") });
    }
    if (!Array.isArray(annotations)) {
      return res.status(400).json({ success: false, message: "annotations must be an array" });
    }

    const resolvedFolder = resolveFolder(folderPath);
    const baseName = path.parse(imageName).name;
    const payload = { imageName, imageWidth, imageHeight, annotations };

    // sir wants only one format per folder, so we lock it the first time
    // someone saves and reject anything that tries a different format after that
    const formatMarkerPath = path.join(resolvedFolder, ".labelme_format");
    let lockedFormat = null;
    if (fs.existsSync(formatMarkerPath)) {
      lockedFormat = fs.readFileSync(formatMarkerPath, "utf-8").trim();
    }
    if (lockedFormat && lockedFormat !== format) {
      return res.status(409).json({
        success: false,
        message: "this folder is already using " + lockedFormat + " format, cant mix formats in same folder",
      });
    }
    if (!lockedFormat) {
      fs.writeFileSync(formatMarkerPath, format);
    }

    let savedFile;

    if (format === "coco") {
      const jsonPath = path.join(resolvedFolder, "annotations.json");
      let existing = null;
      if (fs.existsSync(jsonPath)) {
        existing = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      }
      const cocoJson = toCOCO(payload, existing);
      fs.writeFileSync(jsonPath, cocoJson);
      savedFile = "annotations.json";
    } else if (format === "pascal_voc") {
      const xmlPath = safeJoin(resolvedFolder, baseName + ".xml");
      const xml = toPascalVOC(payload);
      fs.writeFileSync(xmlPath, xml);
      savedFile = baseName + ".xml";
    } else if (format === "yolo") {
      // classes.txt keeps the class -> id mapping consistent across
      // every image in the folder, otherwise ids would reset each save
      const classesPath = path.join(resolvedFolder, "classes.txt");
      let labelMap = {};
      if (fs.existsSync(classesPath)) {
        const lines = fs.readFileSync(classesPath, "utf-8").split("\n").filter(Boolean);
        lines.forEach((label, idx) => (labelMap[label] = idx));
      }

      const result = toYOLO(payload, labelMap);
      const txt = result.txt;
      const updatedMap = result.labelMap;

      const orderedLabels = Object.entries(updatedMap)
        .sort((a, b) => a[1] - b[1])
        .map((entry) => entry[0]);
      fs.writeFileSync(classesPath, orderedLabels.join("\n"));

      const txtPath = safeJoin(resolvedFolder, baseName + ".txt");
      fs.writeFileSync(txtPath, txt);
      savedFile = baseName + ".txt";
    }

    res.json({
      success: true,
      message: "annotation saved in " + format + " format",
      savedFile,
      folder: resolvedFolder,
    });
  } catch (err) {
    console.log("save annotation failed:", err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/annotations/load?path=&format=&imageName=
// loads back whatever is already saved for this image so frontend can
// show the existing boxes when user reopens an image they already did
const loadAnnotation = (req, res) => {
  try {
    const folderPath = req.query.path;
    const format = req.query.format;
    const imageName = req.query.imageName;

    if (!folderPath || !format || !imageName) {
      return res.status(400).json({ success: false, message: "path, format and imageName are required" });
    }

    const resolvedFolder = resolveFolder(folderPath);
    const baseName = path.parse(imageName).name;

    if (format === "coco") {
      const jsonPath = path.join(resolvedFolder, "annotations.json");
      if (!fs.existsSync(jsonPath)) {
        return res.json({ success: true, annotations: [] });
      }
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const image = data.images.find((img) => img.file_name === imageName);
      if (!image) return res.json({ success: true, annotations: [] });

      const anns = data.annotations
        .filter((a) => a.image_id === image.id)
        .map((a) => {
          const category = data.categories.find((c) => c.id === a.category_id);
          return {
            label: category ? category.name : "unknown",
            type: "bbox",
            bbox: a.bbox,
          };
        });
      return res.json({ success: true, annotations: anns });
    }

    if (format === "pascal_voc") {
      const xmlPath = path.join(resolvedFolder, baseName + ".xml");
      if (!fs.existsSync(xmlPath)) {
        return res.json({ success: true, annotations: [] });
      }
      const xml = fs.readFileSync(xmlPath, "utf-8");
      const anns = [];
      const objectRegex = /<object>([\s\S]*?)<\/object>/g;
      let match;
      while ((match = objectRegex.exec(xml)) !== null) {
        const block = match[1];
        const name = /<name>(.*?)<\/name>/.exec(block);
        const xmin = /<xmin>(.*?)<\/xmin>/.exec(block);
        const ymin = /<ymin>(.*?)<\/ymin>/.exec(block);
        const xmax = /<xmax>(.*?)<\/xmax>/.exec(block);
        const ymax = /<ymax>(.*?)<\/ymax>/.exec(block);

        const x1 = parseFloat(xmin[1]);
        const y1 = parseFloat(ymin[1]);
        const x2 = parseFloat(xmax[1]);
        const y2 = parseFloat(ymax[1]);

        anns.push({
          label: name[1],
          type: "bbox",
          bbox: [x1, y1, x2 - x1, y2 - y1],
        });
      }
      return res.json({ success: true, annotations: anns });
    }

    if (format === "yolo") {
      const txtPath = path.join(resolvedFolder, baseName + ".txt");
      const classesPath = path.join(resolvedFolder, "classes.txt");
      if (!fs.existsSync(txtPath) || !fs.existsSync(classesPath)) {
        return res.json({ success: true, annotations: [] });
      }

      const classes = fs.readFileSync(classesPath, "utf-8").split("\n").filter(Boolean);
      const lines = fs.readFileSync(txtPath, "utf-8").split("\n").filter(Boolean);

      // yolo coords are normalized (0-1) so we need actual pixel size to convert back
      // frontend sends these as query params since backend doesnt decode images
      const imgW = parseFloat(req.query.imageWidth);
      const imgH = parseFloat(req.query.imageHeight);

      const anns = lines.map((line) => {
        const parts = line.trim().split(/\s+/).map(Number);
        const classId = parts[0];
        const cx = parts[1];
        const cy = parts[2];
        const w = parts[3];
        const h = parts[4];

        const label = classes[classId] || ("class_" + classId);
        const boxW = w * imgW;
        const boxH = h * imgH;
        const x = cx * imgW - boxW / 2;
        const y = cy * imgH - boxH / 2;
        return { label, type: "bbox", bbox: [x, y, boxW, boxH] };
      });
      return res.json({ success: true, annotations: anns });
    }

    res.status(400).json({ success: false, message: "unknown format" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

module.exports = { saveAnnotation, loadAnnotation };
