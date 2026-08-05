-- CreateTable
CREATE TABLE "Contractor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "sub_contractor_name" TEXT
);

-- CreateTable
CREATE TABLE "Manhole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "qr_code_id" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "manhole_id" INTEGER NOT NULL,
    "contractor_id" INTEGER NOT NULL,
    "supervisor_id" INTEGER NOT NULL,
    "scheduled_time" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrder_manhole_id_fkey" FOREIGN KEY ("manhole_id") REFERENCES "Manhole" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "Contractor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "Supervisor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PermitEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "work_order_id" INTEGER NOT NULL,
    "worker_phone" TEXT NOT NULL,
    "entry_photo_path" TEXT,
    "entry_time" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "entry_lat" REAL,
    "entry_lng" REAL,
    "exit_photo_path" TEXT,
    "exit_time" DATETIME,
    "exit_lat" REAL,
    "exit_lng" REAL,
    "worker_confirmed_time" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "admin_resolution_note" TEXT,
    CONSTRAINT "PermitEntry_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "permit_entry_id" INTEGER NOT NULL,
    "message_type" TEXT NOT NULL,
    "delivery_status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsLog_permit_entry_id_fkey" FOREIGN KEY ("permit_entry_id") REFERENCES "PermitEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Manhole_qr_code_id_key" ON "Manhole"("qr_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_phone_key" ON "Supervisor"("phone");

-- CreateIndex
CREATE INDEX "WorkOrder_manhole_id_status_idx" ON "WorkOrder"("manhole_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PermitEntry_work_order_id_key" ON "PermitEntry"("work_order_id");
