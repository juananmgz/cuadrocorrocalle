-- AlterTable
ALTER TABLE "performances" ADD COLUMN     "square_m" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "stage_depth_m" DOUBLE PRECISION,
ADD COLUMN     "stage_width_m" DOUBLE PRECISION;
