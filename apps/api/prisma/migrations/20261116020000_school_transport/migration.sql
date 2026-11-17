CREATE TYPE "TransportDirection" AS ENUM ('TO_SCHOOL', 'FROM_SCHOOL');

CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "name" TEXT NOT NULL,
    "direction" "TransportDirection" NOT NULL,
    "vehicle" TEXT,
    "vehiclePlate" TEXT,
    "driverName" TEXT,
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportStop" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "arrivalTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransportStop_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportStudent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT DEFAULT 'demo-school',
    "routeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "stopId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransportStudent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransportRoute_schoolId_name_direction_key" ON "TransportRoute"("schoolId", "name", "direction");
CREATE INDEX "TransportRoute_schoolId_isActive_direction_idx" ON "TransportRoute"("schoolId", "isActive", "direction");
CREATE UNIQUE INDEX "TransportStop_routeId_order_key" ON "TransportStop"("routeId", "order");
CREATE INDEX "TransportStop_schoolId_routeId_idx" ON "TransportStop"("schoolId", "routeId");
CREATE UNIQUE INDEX "TransportStudent_schoolId_routeId_studentId_key" ON "TransportStudent"("schoolId", "routeId", "studentId");
CREATE INDEX "TransportStudent_schoolId_studentId_isActive_idx" ON "TransportStudent"("schoolId", "studentId", "isActive");
CREATE INDEX "TransportStudent_schoolId_routeId_isActive_idx" ON "TransportStudent"("schoolId", "routeId", "isActive");

ALTER TABLE "TransportStop"
    ADD CONSTRAINT "TransportStop_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransportStudent"
    ADD CONSTRAINT "TransportStudent_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "TransportStudent_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "TransportStudent_stopId_fkey"
    FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
