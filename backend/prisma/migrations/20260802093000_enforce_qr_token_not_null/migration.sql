-- Enforce NOT NULL on Manhole.qr_token now that all existing rows have been
-- backfilled with a cryptographically random token via a one-time script.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Manhole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "qr_code_id" TEXT NOT NULL,
    "qr_token" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL
);
INSERT INTO "new_Manhole" ("id", "lat", "lng", "qr_code_id", "qr_token", "ward") SELECT "id", "lat", "lng", "qr_code_id", "qr_token", "ward" FROM "Manhole";
DROP TABLE "Manhole";
ALTER TABLE "new_Manhole" RENAME TO "Manhole";
CREATE UNIQUE INDEX "Manhole_qr_code_id_key" ON "Manhole"("qr_code_id");
CREATE UNIQUE INDEX "Manhole_qr_token_key" ON "Manhole"("qr_token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
