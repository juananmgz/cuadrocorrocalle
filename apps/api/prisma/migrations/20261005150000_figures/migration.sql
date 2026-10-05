-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "figure_defaults" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "participations" ADD COLUMN     "figure_id" TEXT,
ADD COLUMN     "slot" INTEGER;

-- CreateTable
CREATE TABLE "figures" (
    "id" TEXT NOT NULL,
    "piece_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "x_m" DOUBLE PRECISION NOT NULL,
    "y_m" DOUBLE PRECISION NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "figures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "figures_piece_id_idx" ON "figures"("piece_id");

-- CreateIndex
CREATE INDEX "participations_figure_id_idx" ON "participations"("figure_id");

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_figure_id_fkey" FOREIGN KEY ("figure_id") REFERENCES "figures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figures" ADD CONSTRAINT "figures_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

