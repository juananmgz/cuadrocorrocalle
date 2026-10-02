-- CreateTable
CREATE TABLE "performances" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "place" TEXT,
    "date" DATE,
    "min_minutes" INTEGER,
    "max_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performances_group_id_idx" ON "performances"("group_id");

-- AddForeignKey
ALTER TABLE "performances" ADD CONSTRAINT "performances_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
