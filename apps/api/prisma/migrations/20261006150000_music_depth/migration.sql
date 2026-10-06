-- The musicians' zone is measured in metres, not rows, and goes at the back by default.
ALTER TABLE "performances" DROP COLUMN "music_rows",
ADD COLUMN     "music_depth_m" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
ALTER COLUMN "music_side" SET DEFAULT 'back';
