-- TPE demand splits into its two sous-équipes (Android/Engage) instead of
-- one combined TPE count. Existing tpe_count/tpe_pct is carried over into
-- tpe_android_count/tpe_android_pct (an arbitrary choice — there's no way to
-- know the real split from the old single value); tpe_engage starts at 0.
-- Any project with existing TPE demand should have it reviewed and
-- redistributed between the two after this migration.

ALTER TABLE "demand_lines" ADD COLUMN "tpe_android_count" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "demand_lines" ADD COLUMN "tpe_android_pct" DECIMAL(6,4);
ALTER TABLE "demand_lines" ADD COLUMN "tpe_engage_count" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "demand_lines" ADD COLUMN "tpe_engage_pct" DECIMAL(6,4);

UPDATE "demand_lines" SET "tpe_android_count" = "tpe_count", "tpe_android_pct" = "tpe_pct";

ALTER TABLE "demand_lines" DROP COLUMN "tpe_count";
ALTER TABLE "demand_lines" DROP COLUMN "tpe_pct";
