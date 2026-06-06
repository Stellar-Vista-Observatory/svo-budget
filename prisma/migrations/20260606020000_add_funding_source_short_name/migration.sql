-- Optional user-specified short name / acronym for a funding source.
-- When null, the app falls back to a derived acronym.
ALTER TABLE "funding_sources" ADD COLUMN "shortName" TEXT;
