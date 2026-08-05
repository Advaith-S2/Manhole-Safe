/*
  Warnings:

  - Added the required column `contractor_id` to the `Supervisor` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PermitEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_order_id" INTEGER NOT NULL,
    "worker_phone" TEXT NOT NULL,
    "emergency_contact_phone" TEXT,
    "entry_photo_path" TEXT,
    "entry_time" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "entry_lat" REAL,
    "entry_lng" REAL,
    "exit_photo_path" TEXT,
    "exit_time" DATETIME,
    "exit_lat" REAL,
    "exit_lng" REAL,
    "worker_confirmed_time" DATETIME,
    "worker_confirm_expires_at" DATETIME,
    "location_missing" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "admin_resolution_note" TEXT,
    CONSTRAINT "PermitEntry_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PermitEntry" ("admin_resolution_note", "entry_lat", "entry_lng", "entry_photo_path", "entry_time", "exit_lat", "exit_lng", "exit_photo_path", "exit_time", "id", "status", "work_order_id", "worker_confirmed_time", "worker_phone") SELECT "admin_resolution_note", "entry_lat", "entry_lng", "entry_photo_path", "entry_time", "exit_lat", "exit_lng", "exit_photo_path", "exit_time", "id", "status", "work_order_id", "worker_confirmed_time", "worker_phone" FROM "PermitEntry";
DROP TABLE "PermitEntry";
ALTER TABLE "new_PermitEntry" RENAME TO "PermitEntry";
CREATE UNIQUE INDEX "PermitEntry_work_order_id_key" ON "PermitEntry"("work_order_id");
CREATE INDEX "PermitEntry_status_idx" ON "PermitEntry"("status");
CREATE INDEX "PermitEntry_entry_time_idx" ON "PermitEntry"("entry_time");
CREATE INDEX "PermitEntry_worker_confirm_expires_at_idx" ON "PermitEntry"("worker_confirm_expires_at");
CREATE TABLE "new_Supervisor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "contractor_id" INTEGER NOT NULL,
    CONSTRAINT "Supervisor_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Supervisor" ("id", "name", "password", "phone", "contractor_id") SELECT "id", "name", "password", "phone", 1 FROM "Supervisor";
DROP TABLE "Supervisor";
ALTER TABLE "new_Supervisor" RENAME TO "Supervisor";
CREATE UNIQUE INDEX "Supervisor_phone_key" ON "Supervisor"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
