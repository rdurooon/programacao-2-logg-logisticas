/*
  Warnings:

  - The primary key for the `pessoas_fisicas` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `pessoas_fisicas` table. All the data in the column will be lost.
  - The primary key for the `pessoas_juridicas` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `pessoas_juridicas` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "pessoas_fisicas_cpf_key";

-- DropIndex
DROP INDEX "pessoas_fisicas_pessoaId_key";

-- DropIndex
DROP INDEX "pessoas_juridicas_cnpj_key";

-- DropIndex
DROP INDEX "pessoas_juridicas_pessoaId_key";

-- AlterTable
ALTER TABLE "pessoas_fisicas" DROP CONSTRAINT "pessoas_fisicas_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "pessoas_fisicas_pkey" PRIMARY KEY ("pessoaId");

-- AlterTable
ALTER TABLE "pessoas_juridicas" DROP CONSTRAINT "pessoas_juridicas_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "pessoas_juridicas_pkey" PRIMARY KEY ("pessoaId");
