-- CreateEnum
CREATE TYPE "Role" AS ENUM ('svo', 'hsv');

-- CreateEnum
CREATE TYPE "Squad" AS ENUM ('Mobile', 'TPE', 'Digital');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "squad" "Squad" NOT NULL,
    "sous_equipe" TEXT NOT NULL,
    "role_title" TEXT NOT NULL,

    CONSTRAINT "pool_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "svo_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "demand_submitted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "profile" "Squad" NOT NULL,
    "count" DECIMAL(10,2) NOT NULL,
    "pct" DECIMAL(6,4),

    CONSTRAINT "demand_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "pool_member_id" TEXT NOT NULL,
    "pct" DECIMAL(6,4) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "allocation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_name_key" ON "users"("name");

-- CreateIndex
CREATE INDEX "demand_lines_project_id_idx" ON "demand_lines"("project_id");

-- CreateIndex
CREATE INDEX "allocation_lines_pool_member_id_period_idx" ON "allocation_lines"("pool_member_id", "period");

-- CreateIndex
CREATE INDEX "allocation_lines_project_id_idx" ON "allocation_lines"("project_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_svo_user_id_fkey" FOREIGN KEY ("svo_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_lines" ADD CONSTRAINT "demand_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_pool_member_id_fkey" FOREIGN KEY ("pool_member_id") REFERENCES "pool_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
