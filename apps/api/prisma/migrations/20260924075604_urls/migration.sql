-- CreateEnum
CREATE TYPE "url_status" AS ENUM ('active', 'disabled');

-- CreateTable
CREATE TABLE "urls" (
    "id" BIGINT NOT NULL,
    "short_code" VARCHAR(32) NOT NULL,
    "long_url" VARCHAR(2048) NOT NULL,
    "user_id" UUID,
    "is_custom_alias" BOOLEAN NOT NULL DEFAULT false,
    "status" "url_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(3),
    "purge_at" TIMESTAMPTZ(3),
    "click_count" BIGINT NOT NULL DEFAULT 0,
    "last_clicked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "urls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "urls_short_code_key" ON "urls"("short_code");

-- CreateIndex
CREATE INDEX "urls_user_id_created_at_idx" ON "urls"("user_id", "created_at" DESC);

-- ---- Hand-written: what the Prisma schema language can't express ----

-- The ID-block sequence: each nextval() hands one API instance 1,000 ids (services/idAllocator)
CREATE SEQUENCE "url_id_block_seq" INCREMENT BY 1000 START WITH 1000 MINVALUE 1000;

-- Only rows that will be purged need indexing: most links never expire
CREATE INDEX "urls_purge_at_idx" ON "urls" ("purge_at") WHERE "purge_at" IS NOT NULL;

-- The database enforces what the API validates, so a bug or a manual insert can't break the invariants
ALTER TABLE "urls" ADD CONSTRAINT "urls_short_code_format" CHECK ("short_code" ~ '^[A-Za-z0-9_-]{3,32}$');
ALTER TABLE "urls" ADD CONSTRAINT "urls_long_url_scheme" CHECK ("long_url" ~* '^https?://');
ALTER TABLE "urls" ADD CONSTRAINT "urls_purge_after_expiry" CHECK ("purge_at" IS NULL OR "purge_at" > "expires_at");
