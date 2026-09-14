-- Replace the single "period" week id with a periodStart/periodEnd range on
-- both demand_lines and allocation_lines. Existing rows become 1-week ranges
-- (periodStart = periodEnd = period).

ALTER TABLE "demand_lines" ADD COLUMN "period_start" TEXT;
ALTER TABLE "demand_lines" ADD COLUMN "period_end" TEXT;
UPDATE "demand_lines" SET "period_start" = "period", "period_end" = "period";
ALTER TABLE "demand_lines" ALTER COLUMN "period_start" SET NOT NULL;
ALTER TABLE "demand_lines" ALTER COLUMN "period_end" SET NOT NULL;
ALTER TABLE "demand_lines" DROP COLUMN "period";

ALTER TABLE "allocation_lines" ADD COLUMN "period_start" TEXT;
ALTER TABLE "allocation_lines" ADD COLUMN "period_end" TEXT;
UPDATE "allocation_lines" SET "period_start" = "period", "period_end" = "period";
ALTER TABLE "allocation_lines" ALTER COLUMN "period_start" SET NOT NULL;
ALTER TABLE "allocation_lines" ALTER COLUMN "period_end" SET NOT NULL;
DROP INDEX "allocation_lines_pool_member_id_period_idx";
ALTER TABLE "allocation_lines" DROP COLUMN "period";
CREATE INDEX "allocation_lines_pool_member_id_period_start_period_end_idx" ON "allocation_lines"("pool_member_id", "period_start", "period_end");
