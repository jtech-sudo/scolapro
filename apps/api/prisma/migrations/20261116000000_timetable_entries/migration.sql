CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "assignmentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startsAt" TEXT NOT NULL,
    "endsAt" TEXT NOT NULL,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimetableEntry_schoolId_dayOfWeek_startsAt_idx"
    ON "TimetableEntry"("schoolId", "dayOfWeek", "startsAt");
CREATE INDEX "TimetableEntry_assignmentId_dayOfWeek_idx"
    ON "TimetableEntry"("assignmentId", "dayOfWeek");

ALTER TABLE "TimetableEntry"
    ADD CONSTRAINT "TimetableEntry_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "TeachingAssignment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
