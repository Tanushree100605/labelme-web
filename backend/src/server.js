const express = require("express");
const cors = require("cors");

const folderRoutes = require("./routes/folder");
const annotationRoutes = require("./routes/annotations");
const formatRoutes = require("./routes/format");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" })); // some folders have a lot of polygon points so keeping this higher than default

app.use("/api/folder", folderRoutes);
app.use("/api/annotations", annotationRoutes);
app.use("/api/format", formatRoutes);

app.get("/health", (req, res) => {
  res.json({ success: true, status: "server running" });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: "route not found" });
});

app.use((err, req, res, next) => {
  console.log("server error:", err);
  res.status(500).json({ success: false, message: "something went wrong on server" });
});

app.listen(PORT, () => {
  console.log("backend running on port " + PORT);
});
