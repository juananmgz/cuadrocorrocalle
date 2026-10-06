-- Every performance keeps the back of its stage for the musicians, unless it says otherwise.
UPDATE "performances" SET "music_side" = 'back' WHERE "music_side" IS NULL;
