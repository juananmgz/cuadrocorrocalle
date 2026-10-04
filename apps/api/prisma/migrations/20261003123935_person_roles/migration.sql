-- AlterTable
ALTER TABLE "people" ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
