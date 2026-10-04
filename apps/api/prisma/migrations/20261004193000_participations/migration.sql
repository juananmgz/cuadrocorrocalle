-- CreateTable
CREATE TABLE "participations" (
    "piece_id" TEXT NOT NULL,
    "performance_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "participations_pkey" PRIMARY KEY ("piece_id","person_id")
);

-- CreateIndex
CREATE INDEX "participations_performance_id_person_id_idx" ON "participations"("performance_id", "person_id");

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_piece_id_fkey" FOREIGN KEY ("piece_id") REFERENCES "pieces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participations" ADD CONSTRAINT "participations_performance_id_person_id_fkey" FOREIGN KEY ("performance_id", "person_id") REFERENCES "call_ups"("performance_id", "person_id") ON DELETE CASCADE ON UPDATE CASCADE;

