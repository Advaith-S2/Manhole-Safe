-- Indexes to support the background timer job's frequent polling queries
-- (was doing full table scans every 30 seconds).

-- CreateIndex
CREATE INDEX "PermitEntry_status_idx" ON "PermitEntry"("status");

-- CreateIndex
CREATE INDEX "PermitEntry_entry_time_idx" ON "PermitEntry"("entry_time");

-- CreateIndex
CREATE INDEX "SmsLog_permit_entry_id_message_type_idx" ON "SmsLog"("permit_entry_id", "message_type");
