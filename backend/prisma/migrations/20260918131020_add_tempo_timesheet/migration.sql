-- AlterTable
ALTER TABLE "pool_members" ADD COLUMN     "jira_account_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "jira_project_key" TEXT;

-- CreateTable
CREATE TABLE "logged_time" (
    "id" TEXT NOT NULL,
    "pool_member_id" TEXT NOT NULL,
    "project_id" TEXT,
    "period" TEXT NOT NULL,
    "hours" DECIMAL(6,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tempo',
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "logged_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logged_time_pool_member_id_period_idx" ON "logged_time"("pool_member_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "logged_time_pool_member_id_project_id_period_source_key" ON "logged_time"("pool_member_id", "project_id", "period", "source");

-- AddForeignKey
ALTER TABLE "logged_time" ADD CONSTRAINT "logged_time_pool_member_id_fkey" FOREIGN KEY ("pool_member_id") REFERENCES "pool_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logged_time" ADD CONSTRAINT "logged_time_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
