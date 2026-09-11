-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('pending', 'approved');

-- AlterTable
ALTER TABLE "allocation_lines" ADD COLUMN     "status" "AllocationStatus" NOT NULL DEFAULT 'approved';
