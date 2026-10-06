-- AlterTable
ALTER TABLE "people" ADD COLUMN     "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[];
