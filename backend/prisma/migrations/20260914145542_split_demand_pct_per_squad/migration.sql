-- Each squad on a demand row now has its own allocation % instead of one
-- shared value — the existing shared pct is copied to all three so nothing
-- changes numerically for existing rows.

ALTER TABLE "demand_lines" ADD COLUMN "mobile_pct" DECIMAL(6,4);
ALTER TABLE "demand_lines" ADD COLUMN "tpe_pct" DECIMAL(6,4);
ALTER TABLE "demand_lines" ADD COLUMN "digital_pct" DECIMAL(6,4);

UPDATE "demand_lines" SET "mobile_pct" = "pct", "tpe_pct" = "pct", "digital_pct" = "pct";

ALTER TABLE "demand_lines" DROP COLUMN "pct";
