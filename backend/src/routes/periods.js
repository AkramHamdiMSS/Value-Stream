const express = require("express");
const { authenticate } = require("../middleware/auth");
const { generatePeriodObjects } = require("../lib/periods");

const router = express.Router();
router.use(authenticate);

router.get("/", (req, res) => {
  res.json(generatePeriodObjects());
});

module.exports = router;
