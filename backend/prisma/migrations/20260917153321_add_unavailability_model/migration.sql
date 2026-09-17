-- CreateTable
CREATE TABLE "unavailabilities" (
    "id" TEXT NOT NULL,
    "pool_member_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unavailabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "unavailabilities_pool_member_id_start_date_end_date_idx" ON "unavailabilities"("pool_member_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "unavailabilities" ADD CONSTRAINT "unavailabilities_pool_member_id_fkey" FOREIGN KEY ("pool_member_id") REFERENCES "pool_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
