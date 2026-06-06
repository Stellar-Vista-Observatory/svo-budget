-- Persist per-user report selections so they survive across sessions.
-- Budget vs. Actual report: selected project + "Show detail" toggle.
-- Funding Source report: selected project + selected funding source.
ALTER TABLE "user_preferences" ADD COLUMN "reportBvaProjectId" TEXT;
ALTER TABLE "user_preferences" ADD COLUMN "reportBvaShowDetail" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_preferences" ADD COLUMN "reportFsProjectId" TEXT;
ALTER TABLE "user_preferences" ADD COLUMN "reportFsFundingSourceId" TEXT;
