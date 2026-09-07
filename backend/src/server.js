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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur serveur." });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API en écoute sur http://localhost:${port}`));
