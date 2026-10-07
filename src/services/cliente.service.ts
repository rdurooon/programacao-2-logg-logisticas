import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError } from "@/types";

const nomeSchema = z.string().min(5, 'O nome deve ter pelo menos 5 caracteres').max(100);
const cpfSchema = z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido');
const cnpjSchema = z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido');

export const clienteSchema = z.discriminatedUnion('tipoCliente', [
    z.object({
        tipoCliente: z.literal('F'),
        nome: nomeSchema,
        fisica: z.object({
            cpf: cpfSchema,
            rg: z.string().max(20).optional(),
        }),
    }),
    z.object({
        tipoCliente: z.literal('J'),
        nome: nomeSchema,
        juridica: z.object({
            cnpj: cnpjSchema,
            inscricaoEstadual: z.string().max(20).optional(),
        }),
    }),
]);

export const clienteUpdateSchema = z.object({
    nome: nomeSchema.optional(),
    fisica: z.object({
        cpf: cpfSchema.optional(),
        rg: z.string().max(20).optional(),
    }).optional(),
    juridica: z.object({
        cnpj: cnpjSchema.optional(),
        inscricaoEstadual: z.string().max(20).optional(),
    }).optional(),
}).refine((data) => !(data.fisica && data.juridica), {
    message: 'Informe dados de pessoa física ou jurídica, não ambos',
});

export type ClienteInput = z.infer<typeof clienteSchema>;
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>;

const clienteInclude = {
    pessoa: { include: { pessoaFisica: true, pessoaJuridica: true } },
    addresses: true,
} as const;

export class ClienteService {
    async getAllClientes(params: {
        page?: number;
        limit?: number;
        q?: string;
    }) {
        const page = Number.isInteger(params.page) && params.page! > 0 ? params.page! : 1;
        const limit = Number.isInteger(params.limit) && params.limit! > 0 ? params.limit! : 10;
        const search = params.q?.trim();
        const where: Prisma.ClienteWhereInput = search ? {
            OR: [
                { id: { contains: search, mode: 'insensitive' } },
                { pessoa: { is: { pessoaFisica: { is: { nome: { contains: search, mode: 'insensitive' } } } } } },
                { pessoa: { is: { pessoaJuridica: { is: { razaoSocial: { contains: search, mode: 'insensitive' } } } } } },
                { pessoa: { is: { pessoaFisica: { is: { cpf: { contains: search } } } } } },
                { pessoa: { is: { pessoaJuridica: { is: { cnpj: { contains: search } } } } } },
            ],
        } : {};

        return prisma.cliente.findMany({
            skip: (page - 1) * limit,
            take: limit,
            where,
            include: clienteInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getClienteById(id: string) {
        return prisma.cliente.findUnique({
            where: { id },
            include: clienteInclude,
        });
    }

    async createCliente(data: ClienteInput) {
        const clienteData: Prisma.PessoaCreateInput = data.tipoCliente === 'F'
            ? {
                tipoPessoa: data.tipoCliente,
                pessoaFisica: {
                    create: {
                        nome: data.nome,
                        cpf: data.fisica.cpf,
                        ...(data.fisica.rg ? { rg: data.fisica.rg } : {}),
                    },
                },
            }
            : {
                tipoPessoa: data.tipoCliente,
                pessoaJuridica: {
                    create: {
                        razaoSocial: data.nome,
                        cnpj: data.juridica.cnpj,
                        ...(data.juridica.inscricaoEstadual ? { inscricaoEstadual: data.juridica.inscricaoEstadual } : {}),
                    },
                },
            };

        return prisma.$transaction(async (transaction) => {
            const pessoa = await transaction.pessoa.create({ data: clienteData });
            return transaction.cliente.create({
                data: { pessoa: { connect: { id: pessoa.id } } },
                include: clienteInclude,
            });
        });
    }

    async updateCliente(id: string, data: ClienteUpdateInput) {
        return prisma.$transaction(async (transaction) => {
            const cliente = await transaction.cliente.findUnique({
                where: { id },
                include: clienteInclude,
            });
            if (!cliente) return null;

            const pessoaFisica = cliente.pessoa.pessoaFisica;
            const pessoaJuridica = cliente.pessoa.pessoaJuridica;
            if ((data.fisica && !pessoaFisica) || (data.juridica && !pessoaJuridica)) {
                throw new AppError('Os dados informados não correspondem ao tipo do cliente', 400);
            }

            const pessoaData: Prisma.PessoaUpdateInput = {};
            if (pessoaFisica) {
                const fisicaData = {
                    ...(data.nome ? { nome: data.nome } : {}),
                    ...(data.fisica?.cpf ? { cpf: data.fisica.cpf } : {}),
                    ...(data.fisica?.rg ? { rg: data.fisica.rg } : {}),
                };
                if (Object.keys(fisicaData).length > 0) {
                    pessoaData.pessoaFisica = { update: fisicaData };
                }
            }
            if (pessoaJuridica) {
                const juridicaData = {
                    ...(data.nome ? { razaoSocial: data.nome } : {}),
                    ...(data.juridica?.cnpj ? { cnpj: data.juridica.cnpj } : {}),
                    ...(data.juridica?.inscricaoEstadual ? { inscricaoEstadual: data.juridica.inscricaoEstadual } : {}),
                };
                if (Object.keys(juridicaData).length > 0) {
                    pessoaData.pessoaJuridica = { update: juridicaData };
                }
            }

            if (Object.keys(pessoaData).length > 0) {
                await transaction.pessoa.update({ where: { id: cliente.pessoaId }, data: pessoaData });
            }

            return transaction.cliente.findUnique({
                where: { id },
                include: clienteInclude,
            });
        });
    }

    async deleteCliente(id: string) {
        return prisma.$transaction(async (transaction) => {
            const cliente = await transaction.cliente.findUnique({ where: { id }, include: clienteInclude });
            if (!cliente) return null;
            await transaction.pessoa.delete({ where: { id: cliente.pessoaId } });
            return cliente;
        });
    }
}