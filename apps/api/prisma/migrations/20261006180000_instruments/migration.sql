-- AlterTable
ALTER TABLE "pieces" ADD COLUMN     "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "figures" ADD COLUMN     "instrument" TEXT;
