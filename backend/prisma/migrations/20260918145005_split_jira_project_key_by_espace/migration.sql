/*
  Warnings:

  - You are about to drop the column `jira_project_key` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "projects" DROP COLUMN "jira_project_key",
ADD COLUMN     "jira_project_key_digital" TEXT,
ADD COLUMN     "jira_project_key_mobile" TEXT,
ADD COLUMN     "jira_project_key_tpe_android" TEXT,
ADD COLUMN     "jira_project_key_tpe_engage" TEXT;
