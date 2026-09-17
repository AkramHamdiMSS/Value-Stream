/*
  Warnings:

  - You are about to drop the column `demand_comment` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "demand_lines" ADD COLUMN     "comment" TEXT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "demand_comment";
