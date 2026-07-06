-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "mode" VARCHAR(16) NOT NULL DEFAULT 'non-tech',
    "api_credits_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credential_vault_type" VARCHAR(16) NOT NULL DEFAULT 'shamsu',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apis" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "endpoint_url" VARCHAR(255) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "recorded_flow" JSONB NOT NULL,
    "variable_schema" JSONB,
    "output_schema" JSONB,
    "replay_mode" VARCHAR(24) NOT NULL DEFAULT 'browser_replay',
    "credentials_encrypted" TEXT,
    "credential_type" VARCHAR(24) NOT NULL DEFAULT 'stored',
    "max_execution_time" INTEGER NOT NULL DEFAULT 600,
    "cache_enabled" BOOLEAN NOT NULL DEFAULT false,
    "cache_duration" INTEGER NOT NULL DEFAULT 300,
    "rate_limit_per_sec" INTEGER NOT NULL DEFAULT 50,
    "max_concurrent" INTEGER NOT NULL DEFAULT 50,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "is_latest" BOOLEAN NOT NULL DEFAULT true,
    "is_listed_in_marketplace" BOOLEAN NOT NULL DEFAULT false,
    "marketplace_price" DECIMAL(12,2),
    "marketplace_category" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_versions" (
    "id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "recorded_flow" JSONB NOT NULL,
    "variable_schema" JSONB,
    "output_schema" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_calls" (
    "id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "caller_id" TEXT NOT NULL,
    "request_body" JSONB,
    "response_data" JSONB,
    "status" VARCHAR(16) NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "latency_ms" INTEGER,
    "cost_bdt" DECIMAL(12,4),
    "step_count" INTEGER,
    "execution_time_ms" INTEGER,
    "chrome_duration_ms" INTEGER,
    "claude_tokens_used" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "key_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100),
    "created_by_user_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials_vault" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "api_id" TEXT,
    "encrypted_username" TEXT,
    "encrypted_password" TEXT,
    "encrypted_auth_token" TEXT,
    "vault_type" VARCHAR(16) NOT NULL DEFAULT 'basic',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credentials_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "pricing_model" VARCHAR(16) NOT NULL DEFAULT 'per_call',
    "description" TEXT,
    "category" VARCHAR(100),
    "documentation" TEXT,
    "example_request" JSONB,
    "example_response" JSONB,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_purchases" (
    "id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price_paid" DECIMAL(12,2),
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',

    CONSTRAINT "marketplace_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replay_queue" (
    "id" TEXT NOT NULL,
    "api_id" TEXT NOT NULL,
    "caller_id" TEXT NOT NULL,
    "request_body" JSONB,
    "status" VARCHAR(16) NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "replay_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_bdt" DECIMAL(12,2) NOT NULL,
    "credits_added" INTEGER NOT NULL,
    "payment_method" VARCHAR(16) NOT NULL DEFAULT 'bkash',
    "payment_reference" VARCHAR(255),
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "confirmed_by_admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_earnings" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "total_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pending_payout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_out" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_payout_date" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_versions_api_id_version_number_key" ON "api_versions"("api_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_api_id_key" ON "marketplace_listings"("api_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_earnings_creator_id_key" ON "creator_earnings"("creator_id");

-- AddForeignKey
ALTER TABLE "apis" ADD CONSTRAINT "apis_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_versions" ADD CONSTRAINT "api_versions_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_calls" ADD CONSTRAINT "api_calls_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_calls" ADD CONSTRAINT "api_calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials_vault" ADD CONSTRAINT "credentials_vault_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials_vault" ADD CONSTRAINT "credentials_vault_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_purchases" ADD CONSTRAINT "marketplace_purchases_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_queue" ADD CONSTRAINT "replay_queue_api_id_fkey" FOREIGN KEY ("api_id") REFERENCES "apis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_queue" ADD CONSTRAINT "replay_queue_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_confirmed_by_admin_id_fkey" FOREIGN KEY ("confirmed_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_earnings" ADD CONSTRAINT "creator_earnings_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
