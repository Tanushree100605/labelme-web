const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes/api");

const app = express();

// frontend default expects backend on 8000, keeping that as default
// so nobody has to change js/config.js
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "route not found" });
});

app.use((err, req, res, next) => {
  console.log("server error:", err);
  res.status(500).json({ message: "something went wrong on server" });
});

app.listen(PORT, () => {
  console.log("backend listening on http://localhost:" + PORT + "/api");
});
