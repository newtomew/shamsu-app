-- CreateTable
CREATE TABLE "sessions" (
    "api_id" TEXT NOT NULL,
    "cookies" JSONB NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("api_id")
);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
