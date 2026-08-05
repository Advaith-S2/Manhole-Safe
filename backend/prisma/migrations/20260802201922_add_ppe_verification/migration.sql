-- AlterTable
ALTER TABLE "PermitEntry" ADD COLUMN "ppe_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PermitEntry" ADD COLUMN "ppe_detection_result" TEXT;
