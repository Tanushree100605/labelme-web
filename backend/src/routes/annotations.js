const express = require("express");
const router = express.Router();
const { saveAnnotation, loadAnnotation } = require("../controllers/annotationController");

router.post("/save", saveAnnotation);
router.get("/load", loadAnnotation);

module.exports = router;
