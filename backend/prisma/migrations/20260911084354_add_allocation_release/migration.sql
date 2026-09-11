-- AlterTable
ALTER TABLE "allocation_lines" ADD COLUMN     "release_note" TEXT,
ADD COLUMN     "release_requested" BOOLEAN NOT NULL DEFAULT false;
