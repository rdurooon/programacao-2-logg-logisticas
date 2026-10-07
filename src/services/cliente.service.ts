import prisma from "@/lib/prisma";
import { Cliente, Prisma } from "@prisma/client";
import { z } from "zod";

const clienteSchema = z.object({
    nome: z.string()
        .min(5, 'O nome deve ter pelo menos 5 caracteres')
        .max(100),
    fisica: z.object({
        cpf: z.string()
            .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido')
            .optional(),
        rg: z.string()
            .max(20, 'O RG deve ter no máximo 20 caracteres')
            .optional(),
    }).optional(),
    juridica: z.object({
        cnpj: z.string()
            .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido')
            .optional(),
        inscricaoEstadual: z.string()
            .max(20, 'A inscrição estadual deve ter no máximo 20 caracteres')
            .optional(),
    }).optional(),
    // email: z.string().email().optional(),
    // telefone: z.string().max(20).optional(),
    // endereco: z.string().max(200).optional(),
    tipoCliente: z.enum(['F', 'J'])
});

export type ClienteInput = z.infer<typeof clienteSchema> & Prisma.ClienteCreateInput;

export class ClienteService {
    async getAllClientes(params: {
        skip?: number;
        limit?: number;
        where?: any;
        orderBy?: any
        // Prisma.ClienteOrderByWithRelationInput | Prisma.ClienteOrderByWithRelationInput[];
    }): Promise<Cliente[]> {
        const { skip = 0, limit = 10, where, orderBy } = params;
        const clientes = await prisma.cliente.findMany({
            skip,
            take: limit,
        });
        return clientes;
    }

    async getClienteById(id: string): Promise<Cliente | null> {
        const cliente = await prisma.cliente.findUnique({
            where: { id },
        });
        return cliente;
    }

    async createCliente(data: ClienteInput): Promise<Cliente> {
        const pessoa = await prisma.pessoa.create({
            data: {
                tipoPessoa: data.tipoCliente === 'F' ? 'F' : 'J',
            },
        });
        const newCliente = data.tipoCliente === 'F' 
            ? await prisma.cliente.create({
                data: {
                    ...data,
                    pessoaId: pessoa.id,
                },
            })
            : await prisma.cliente.create({
                data: {
                    ...data,
                    pessoaId: pessoa.id,
                },
            });
        return newCliente;
    }

    async updateCliente(id: string, data: Prisma.ClienteUpdateInput): Promise<Cliente | null> {
        const updatedCliente = await prisma.cliente.update({
            where: { id },
            data,
        });
        return updatedCliente;
    }

    async deleteCliente(id: string): Promise<Cliente | null> {
        const deletedCliente = await prisma.cliente.delete({
            where: { id },
        });
        return deletedCliente;
    }
}