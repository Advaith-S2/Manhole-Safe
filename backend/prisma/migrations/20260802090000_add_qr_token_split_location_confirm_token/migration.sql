-- Contractor.password / Contractor.username already exist in this database
-- (added out-of-band before migration history caught up); not re-added here.

-- AlterTable
ALTER TABLE "Manhole" ADD COLUMN "qr_token" TEXT;

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
    "entry_location_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "exit_location_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "entry_location_missing" BOOLEAN NOT NULL DEFAULT false,
    "exit_location_missing" BOOLEAN NOT NULL DEFAULT false,
    "worker_confirm_token" TEXT,
    "worker_confirm_token_used" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "admin_resolution_note" TEXT,
    CONSTRAINT "PermitEntry_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PermitEntry" ("admin_resolution_note", "emergency_contact_phone", "entry_lat", "entry_lng", "entry_photo_path", "entry_time", "exit_lat", "exit_lng", "exit_photo_path", "exit_time", "id", "location_missing", "status", "work_order_id", "worker_confirm_expires_at", "worker_confirmed_time", "worker_phone") SELECT "admin_resolution_note", "emergency_contact_phone", "entry_lat", "entry_lng", "entry_photo_path", "entry_time", "exit_lat", "exit_lng", "exit_photo_path", "exit_time", "id", "location_missing", "status", "work_order_id", "worker_confirm_expires_at", "worker_confirmed_time", "worker_phone" FROM "PermitEntry";
DROP TABLE "PermitEntry";
ALTER TABLE "new_PermitEntry" RENAME TO "PermitEntry";
CREATE UNIQUE INDEX "PermitEntry_work_order_id_key" ON "PermitEntry"("work_order_id");
CREATE UNIQUE INDEX "PermitEntry_worker_confirm_token_key" ON "PermitEntry"("worker_confirm_token");
CREATE INDEX "PermitEntry_status_idx" ON "PermitEntry"("status");
CREATE INDEX "PermitEntry_entry_time_idx" ON "PermitEntry"("entry_time");
CREATE INDEX "PermitEntry_worker_confirm_expires_at_idx" ON "PermitEntry"("worker_confirm_expires_at");
CREATE TABLE "new_Supervisor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "contractor_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Supervisor_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Supervisor" ("contractor_id", "id", "name", "password", "phone") SELECT "contractor_id", "id", "name", "password", "phone" FROM "Supervisor";
DROP TABLE "Supervisor";
ALTER TABLE "new_Supervisor" RENAME TO "Supervisor";
CREATE UNIQUE INDEX "Supervisor_phone_key" ON "Supervisor"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Contractor_username_key already exists in this database.

-- CreateIndex
CREATE UNIQUE INDEX "Manhole_qr_token_key" ON "Manhole"("qr_token");
