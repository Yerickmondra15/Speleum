-- Add a temporary account lock timestamp for progressive brute-force protection.
ALTER TABLE "public"."User"
ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Distinguish unverified local history from server-authoritative competitive matches.
ALTER TABLE "public"."Match"
ADD COLUMN "verificationLevel" TEXT NOT NULL DEFAULT 'local_unverified';

CREATE INDEX "Match_mode_verificationLevel_endedAt_idx"
ON "public"."Match"("mode", "verificationLevel", "endedAt");
