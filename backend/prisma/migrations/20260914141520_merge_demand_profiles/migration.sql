-- One demand_lines row now covers all three squads for a range, instead of
-- a separate row per squad. Existing rows sharing the same
-- (project, period_start, period_end) are merged into one, summing each
-- squad's count into its own column; pct keeps the highest of the merged
-- rows (they were always created equal in practice).

ALTER TABLE "demand_lines" ADD COLUMN "mobile_count" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "demand_lines" ADD COLUMN "tpe_count" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "demand_lines" ADD COLUMN "digital_count" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TEMP TABLE "demand_lines_merged" AS
SELECT
  MIN(id) AS id,
  project_id,
  period_start,
  period_end,
  COALESCE(SUM(CASE WHEN profile = 'Mobile' THEN count ELSE 0 END), 0) AS mobile_count,
  COALESCE(SUM(CASE WHEN profile = 'TPE' THEN count ELSE 0 END), 0) AS tpe_count,
  COALESCE(SUM(CASE WHEN profile = 'Digital' THEN count ELSE 0 END), 0) AS digital_count,
  MAX(pct) AS pct
FROM "demand_lines"
GROUP BY project_id, period_start, period_end;

DELETE FROM "demand_lines";

INSERT INTO "demand_lines" (id, project_id, period_start, period_end, mobile_count, tpe_count, digital_count, pct, profile, count)
SELECT id, project_id, period_start, period_end, mobile_count, tpe_count, digital_count, pct, 'Mobile', 0
FROM "demand_lines_merged";

ALTER TABLE "demand_lines" DROP COLUMN "profile";
ALTER TABLE "demand_lines" DROP COLUMN "count";

DROP TABLE "demand_lines_merged";
