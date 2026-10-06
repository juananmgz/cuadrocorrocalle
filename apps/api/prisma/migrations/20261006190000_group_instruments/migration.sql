-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "instruments" TEXT[] DEFAULT ARRAY[]::TEXT[];
