-- AlterTable
ALTER TABLE "allocation_lines" ADD COLUMN     "backup_pool_member_id" TEXT;

-- AddForeignKey
ALTER TABLE "allocation_lines" ADD CONSTRAINT "allocation_lines_backup_pool_member_id_fkey" FOREIGN KEY ("backup_pool_member_id") REFERENCES "pool_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
