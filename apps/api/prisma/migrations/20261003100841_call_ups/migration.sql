-- AlterTable
ALTER TABLE "people" ADD COLUMN     "membership" TEXT NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "call_ups" (
    "performance_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "call_ups_pkey" PRIMARY KEY ("performance_id","person_id")
);

-- CreateIndex
CREATE INDEX "call_ups_person_id_idx" ON "call_ups"("person_id");

-- AddForeignKey
ALTER TABLE "call_ups" ADD CONSTRAINT "call_ups_performance_id_fkey" FOREIGN KEY ("performance_id") REFERENCES "performances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_ups" ADD CONSTRAINT "call_ups_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
