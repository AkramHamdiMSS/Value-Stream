const express = require("express");
const prisma = require("../lib/prisma");
const { authenticate, requirePermission } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, requirePermission("viewActivity"));

router.get("/", async (req, res) => {
  const where = {};
  if (req.query.userId) where.userId = req.query.userId;
  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  res.json(logs);
});

module.exports = router;
