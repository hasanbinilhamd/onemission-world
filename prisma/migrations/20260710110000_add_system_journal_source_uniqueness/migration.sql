CREATE UNIQUE INDEX "JournalEntry_system_source_unique_idx"
ON "JournalEntry"("journalSource", "sourceId", "journalType")
WHERE "sourceId" <> '' AND "journalType" = 'System';
