require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const poolRoutes = require("./routes/pool");
const projectsRoutes = require("./routes/projects");
const demandLinesRoutes = require("./routes/demandLines");
const allocationLinesRoutes = require("./routes/allocationLines");
const demandQueueRoutes = require("./routes/demandQueue");
const dashboardRoutes = require("./routes/dashboard");
const periodsRoutes = require("./routes/periods");
const activityRoutes = require("./routes/activity");
const adminRoutes = require("./routes/admin");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/pool", poolRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/demand-lines", demandLinesRoutes);
app.use("/api/allocation-lines", allocationLinesRoutes);
app.use("/api/demand-queue", demandQueueRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/periods", periodsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/admin", adminRoutes);

// Serve built frontend in production
const frontendDist = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));

// SPA fallback: return index.html for non-API routes
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur." });
});

const port = process.env.PORT || 4000;
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => console.log(`API en ecoute sur http://${host}:${port}`));
