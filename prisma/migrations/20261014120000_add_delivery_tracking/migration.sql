ALTER TABLE "clientes"
ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "clientes_userId_key" ON "clientes"("userId");

ALTER TABLE "clientes"
ADD CONSTRAINT "clientes_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "packages"
ADD COLUMN "originAddressId" TEXT,
ADD COLUMN "courierId" TEXT;

ALTER TABLE "packages"
ADD CONSTRAINT "packages_originAddressId_fkey"
FOREIGN KEY ("originAddressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "packages_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "package_events" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "package_events_packageId_createdAt_idx" ON "package_events"("packageId", "createdAt");

ALTER TABLE "package_events"
ADD CONSTRAINT "package_events_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "package_events" ("id", "packageId", "status", "createdAt")
SELECT gen_random_uuid()::text, "id", "status", "createdAt" FROM "packages";