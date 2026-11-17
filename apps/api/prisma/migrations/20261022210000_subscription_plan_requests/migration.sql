CREATE TYPE "SubscriptionPlanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "SubscriptionPlanRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "pendingSchoolId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL,
    "status" "SubscriptionPlanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "SubscriptionPlanRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionPlanRequest_status_requestedAt_idx" ON "SubscriptionPlanRequest"("status", "requestedAt");
CREATE INDEX "SubscriptionPlanRequest_schoolId_status_idx" ON "SubscriptionPlanRequest"("schoolId", "status");
CREATE UNIQUE INDEX "SubscriptionPlanRequest_pendingSchoolId_key" ON "SubscriptionPlanRequest"("pendingSchoolId");

ALTER TABLE "SubscriptionPlanRequest" ADD CONSTRAINT "SubscriptionPlanRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
