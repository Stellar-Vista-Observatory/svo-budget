-- Rename the orphaned allocatedTotal column to totalFunds (the gross funding
-- amount at origination, before any allocation or spending).
ALTER TABLE "funding_sources" RENAME COLUMN "allocatedTotal" TO "totalFunds";
