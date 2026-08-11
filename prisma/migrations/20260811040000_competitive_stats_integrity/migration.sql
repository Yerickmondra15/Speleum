-- Keep the competitive cache reconstructible and prevent partial matches from
-- contributing before every authoritative participant result is present.
ALTER TABLE "public"."UserStats"
ADD COLUMN "bestScore" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."Match"
ADD COLUMN "participantCount" INTEGER,
ADD COLUMN "competitiveStatsApplied" BOOLEAN NOT NULL DEFAULT false;
