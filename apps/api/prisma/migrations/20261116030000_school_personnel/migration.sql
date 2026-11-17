CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "contractType" TEXT,
    "hiredAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffLeave" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "staffId" TEXT NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffLeave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffMember_schoolId_employeeNumber_key"
    ON "StaffMember"("schoolId", "employeeNumber");
CREATE INDEX "StaffMember_schoolId_isActive_lastName_idx"
    ON "StaffMember"("schoolId", "isActive", "lastName");
CREATE INDEX "StaffLeave_schoolId_status_startsOn_idx"
    ON "StaffLeave"("schoolId", "status", "startsOn");
CREATE INDEX "StaffLeave_staffId_startsOn_endsOn_idx"
    ON "StaffLeave"("staffId", "startsOn", "endsOn");

ALTER TABLE "StaffLeave"
    ADD CONSTRAINT "StaffLeave_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
