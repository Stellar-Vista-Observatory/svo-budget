-- Wipe existing data (user approved)
DELETE FROM "actuals";
DELETE FROM "funding_allocations";
DELETE FROM "line_items";
DELETE FROM "categories";

-- DropForeignKey
ALTER TABLE "actuals" DROP CONSTRAINT IF EXISTS "actuals_lineItemId_fkey";
ALTER TABLE "funding_allocations" DROP CONSTRAINT IF EXISTS "funding_allocations_lineItemId_fkey";
ALTER TABLE "line_items" DROP CONSTRAINT IF EXISTS "line_items_categoryId_fkey";
ALTER TABLE "line_items" DROP CONSTRAINT IF EXISTS "line_items_projectId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "actuals_lineItemId_idx";
DROP INDEX IF EXISTS "actuals_qboTransactionId_lineItemId_key";
DROP INDEX IF EXISTS "funding_allocations_lineItemId_fundingSourceId_key";
DROP INDEX IF EXISTS "line_items_categoryId_idx";

-- AlterTable actuals: remove lineItemId, add categoryId
ALTER TABLE "actuals" DROP COLUMN "lineItemId",
ADD COLUMN "categoryId" TEXT NOT NULL;

-- AlterTable categories: add QBO tracking fields
ALTER TABLE "categories" ADD COLUMN "qboAccountId" TEXT,
ADD COLUMN "qboAccountName" TEXT;

-- AlterTable funding_allocations: remove lineItemId, add budgetEntryId
ALTER TABLE "funding_allocations" DROP COLUMN "lineItemId",
ADD COLUMN "budgetEntryId" TEXT NOT NULL;

-- DropTable line_items (replaced by budget_entries)
DROP TABLE "line_items";

-- CreateTable budget_entries
CREATE TABLE "budget_entries" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budget_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_entries_categoryId_idx" ON "budget_entries"("categoryId");
CREATE INDEX "actuals_categoryId_idx" ON "actuals"("categoryId");
CREATE UNIQUE INDEX "actuals_qboTransactionId_categoryId_key" ON "actuals"("qboTransactionId", "categoryId");
CREATE UNIQUE INDEX "categories_qboAccountId_key" ON "categories"("qboAccountId");
CREATE UNIQUE INDEX "funding_allocations_budgetEntryId_fundingSourceId_key" ON "funding_allocations"("budgetEntryId", "fundingSourceId");

-- AddForeignKey
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "funding_allocations" ADD CONSTRAINT "funding_allocations_budgetEntryId_fkey"
    FOREIGN KEY ("budgetEntryId") REFERENCES "budget_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "actuals" ADD CONSTRAINT "actuals_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
