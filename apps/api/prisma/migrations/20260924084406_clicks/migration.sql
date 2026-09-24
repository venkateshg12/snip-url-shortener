-- CreateTable
CREATE TABLE "clicks" (
    "id" UUID NOT NULL,
    "url_id" BIGINT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "referrer_host" VARCHAR(255),
    "browser" VARCHAR(64),
    "os" VARCHAR(64),
    "device" VARCHAR(16),
    "country" CHAR(2),
    "visitor" CHAR(64) NOT NULL,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clicks_url_id_occurred_at_idx" ON "clicks"("url_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_url_id_fkey" FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
