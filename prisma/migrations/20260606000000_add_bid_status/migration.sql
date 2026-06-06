-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('bid', 'not_bid');

-- AlterTable
ALTER TABLE "budget_entries" ADD COLUMN "bidStatus" "BidStatus";

-- AlterTable
ALTER TABLE "actuals" ADD COLUMN "bidStatus" "BidStatus";
