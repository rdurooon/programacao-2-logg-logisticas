ALTER TABLE "address"
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "package_events"
ADD COLUMN "details" TEXT,
ADD COLUMN "actorId" TEXT;

ALTER TABLE "package_events"
ADD CONSTRAINT "package_events_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "package_offers" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "package_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "package_offers_packageId_status_idx" ON "package_offers"("packageId", "status");
CREATE INDEX "package_offers_courierId_status_idx" ON "package_offers"("courierId", "status");

ALTER TABLE "package_offers"
ADD CONSTRAINT "package_offers_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "package_offers_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "package_locations" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_locations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "package_locations_packageId_recordedAt_idx" ON "package_locations"("packageId", "recordedAt");

ALTER TABLE "package_locations"
ADD CONSTRAINT "package_locations_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "package_locations_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "package_incidents" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "package_incidents_packageId_createdAt_idx" ON "package_incidents"("packageId", "createdAt");

ALTER TABLE "package_incidents"
ADD CONSTRAINT "package_incidents_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "package_incidents_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_notifications_userId_createdAt_idx" ON "user_notifications"("userId", "createdAt");

ALTER TABLE "user_notifications"
ADD CONSTRAINT "user_notifications_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "user_notifications_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;