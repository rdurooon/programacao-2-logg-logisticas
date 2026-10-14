CREATE TABLE "courier_locations" (
    "courierId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courier_locations_pkey" PRIMARY KEY ("courierId")
);

CREATE INDEX "courier_locations_updatedAt_idx" ON "courier_locations"("updatedAt");

ALTER TABLE "courier_locations"
ADD CONSTRAINT "courier_locations_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;