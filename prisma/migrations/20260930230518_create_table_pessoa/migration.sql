-- CreateTable
CREATE TABLE "pessoas" (
    "id" TEXT NOT NULL,
    "tipoPessoa" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas_fisicas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_fisicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas_juridicas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pessoas_juridicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_fisicas_pessoaId_key" ON "pessoas_fisicas"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_fisicas_cpf_key" ON "pessoas_fisicas"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_juridicas_pessoaId_key" ON "pessoas_juridicas"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_juridicas_cnpj_key" ON "pessoas_juridicas"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_pessoaId_key" ON "clientes"("pessoaId");
