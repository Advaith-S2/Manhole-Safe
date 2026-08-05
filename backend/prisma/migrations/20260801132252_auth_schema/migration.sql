/*
  Warnings:

  - Added the required column `password` to the `Supervisor` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Admin" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Supervisor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL
);
INSERT INTO "new_Supervisor" ("id", "name", "phone") SELECT "id", "name", "phone" FROM "Supervisor";
DROP TABLE "Supervisor";
ALTER TABLE "new_Supervisor" RENAME TO "Supervisor";
CREATE UNIQUE INDEX "Supervisor_phone_key" ON "Supervisor"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");
