DELETE FROM "address"
WHERE "id" = '646de18c-13a1-448e-a3e1-af582758aade';

ALTER TABLE "address"
ADD COLUMN "clienteId" TEXT NOT NULL;

ALTER TABLE "pessoas_fisicas"
ADD COLUMN "rg" TEXT;

ALTER TABLE "pessoas_juridicas"
ADD COLUMN "inscricaoEstadual" TEXT;

ALTER TABLE "address"
ADD CONSTRAINT "address_clienteId_fkey"
FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;