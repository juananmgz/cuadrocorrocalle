-- CreateTable
CREATE TABLE "pieces" (
    "id" TEXT NOT NULL,
    "performance_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "duration_s" INTEGER,
    "structure" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pieces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pieces_performance_id_position_idx" ON "pieces"("performance_id", "position");

-- AddForeignKey
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_performance_id_fkey" FOREIGN KEY ("performance_id") REFERENCES "performances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

