-- AlterTable
ALTER TABLE "figures" ADD COLUMN     "arms" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
