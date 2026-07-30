const express = require("express");
const router = express.Router();

const { openFolder, serveImageFile } = require("../controllers/folderController");
const { saveClasses } = require("../controllers/classController");
const { saveAnnotationsForImage } = require("../controllers/annotationController");

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.post("/folders/open", openFolder);
router.get("/folders/:sessionId/images/:imageName/file", serveImageFile);
router.put("/folders/:sessionId/classes", saveClasses);
router.put("/folders/:sessionId/annotations/:imageName", saveAnnotationsForImage);

module.exports = router;
