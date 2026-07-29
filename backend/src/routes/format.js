const express = require("express");
const router = express.Router();
const { getFolderFormat, resetFolderFormat } = require("../controllers/formatController");

router.get("/", getFolderFormat);
router.post("/reset", resetFolderFormat);

module.exports = router;
