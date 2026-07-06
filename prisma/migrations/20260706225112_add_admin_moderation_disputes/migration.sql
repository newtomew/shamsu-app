-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "moderation_status" VARCHAR(16) NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "resolution" VARCHAR(24),
    "admin_notes" TEXT,
    "test_result" JSONB,
    "resolved_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "marketplace_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
