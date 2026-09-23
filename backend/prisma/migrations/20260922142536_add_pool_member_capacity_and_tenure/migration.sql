-- AlterTable
ALTER TABLE "pool_members" ADD COLUMN     "capacity_pct" DECIMAL(4,2) NOT NULL DEFAULT 1,
ADD COLUMN     "end_date" TIMESTAMP(3),
ADD COLUMN     "start_date" TIMESTAMP(3);
