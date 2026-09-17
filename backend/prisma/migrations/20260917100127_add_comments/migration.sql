-- AlterTable
ALTER TABLE "allocation_lines" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "validation_comment" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "demand_comment" TEXT;
