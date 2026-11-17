CREATE TYPE "OnlineEnrollmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'ENROLLED');

CREATE TABLE "OnlineEnrollmentRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "sex" TEXT,
    "requestedClassId" TEXT NOT NULL,
    "guardianFirstName" TEXT NOT NULL,
    "guardianLastName" TEXT NOT NULL,
    "guardianPhone" TEXT NOT NULL,
    "guardianEmail" TEXT,
    "guardianAddress" TEXT,
    "relationship" TEXT NOT NULL,
    "status" "OnlineEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "convertedStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnlineEnrollmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnlineEnrollmentRequest_convertedStudentId_key"
    ON "OnlineEnrollmentRequest"("convertedStudentId");
CREATE INDEX "OnlineEnrollmentRequest_schoolId_status_createdAt_idx"
    ON "OnlineEnrollmentRequest"("schoolId", "status", "createdAt");
CREATE INDEX "OnlineEnrollmentRequest_schoolId_requestedClassId_idx"
    ON "OnlineEnrollmentRequest"("schoolId", "requestedClassId");

ALTER TABLE "OnlineEnrollmentRequest"
    ADD CONSTRAINT "OnlineEnrollmentRequest_requestedClassId_fkey"
    FOREIGN KEY ("requestedClassId") REFERENCES "SchoolClass"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "OnlineEnrollmentRequest_convertedStudentId_fkey"
    FOREIGN KEY ("convertedStudentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
