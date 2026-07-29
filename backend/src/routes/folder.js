const express = require("express");
const router = express.Router();
const { listFolder, serveImage } = require("../controllers/folderController");

router.get("/list", listFolder);
router.get("/image", serveImage);

module.exports = router;
