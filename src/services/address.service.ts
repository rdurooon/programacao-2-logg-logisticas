import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/types';

export const addressSchema = z.object({
    clienteId: z.string().min(1, 'Cliente é obrigatório'),
    cep: z.string().min(1, 'CEP é obrigatório'),
    logradouro: z.string().min(1, 'Logradouro é obrigatório'),
    numero: z.string().min(1, 'Número é obrigatório'),
    complemento: z.string().default(''),
    bairro: z.string().min(1, 'Bairro é obrigatório'),
    cidade: z.string().min(1, 'Cidade é obrigatória'),
    estado: z.string().min(1, 'Estado é obrigatório'),
    pais: z.string().min(1, 'País é obrigatório'),
});

export const addressUpdateSchema = addressSchema.partial();

export type AddressInput = z.infer<typeof addressSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;

export class AddressService {
    async getAllAddresses(params: { page?: number; limit?: number; clienteId?: string; q?: string }) {
        const page = Number.isInteger(params.page) && params.page! > 0 ? params.page! : 1;
        const limit = Number.isInteger(params.limit) && params.limit! > 0 ? params.limit! : 10;
        const search = params.q?.trim();
        const where: Prisma.AddressWhereInput = {
            ...(params.clienteId ? { clienteId: params.clienteId } : {}),
            ...(search ? {
                OR: [
                    { cep: { contains: search, mode: 'insensitive' } },
                    { logradouro: { contains: search, mode: 'insensitive' } },
                    { bairro: { contains: search, mode: 'insensitive' } },
                    { cidade: { contains: search, mode: 'insensitive' } },
                ],
            } : {}),
        };

        return prisma.address.findMany({
            skip: (page - 1) * limit,
            take: limit,
            where,
            include: { cliente: true },
            orderBy: { id: 'asc' },
        });
    }

    async getAddressById(id: string) {
        return prisma.address.findUnique({
            where: { id },
            include: { cliente: true },
        });
    }

    async createAddress(data: AddressInput) {
        try {
            return await prisma.address.create({
                data,
                include: { cliente: true },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new AppError('Cliente não encontrado', 404);
            }
            throw error;
        }
    }

    async updateAddress(id: string, data: AddressUpdateInput) {
        const address = await prisma.address.findUnique({ where: { id } });
        if (!address) return null;

        if (data.clienteId && data.clienteId !== address.clienteId) {
            const packageUsingAddress = await prisma.package.findFirst({ where: { addressId: id } });
            if (packageUsingAddress) {
                throw new AppError('Não é possível transferir um endereço que já possui pacotes', 409);
            }
        }

        try {
            const addressData: Prisma.AddressUncheckedUpdateInput = {
                ...(data.clienteId !== undefined ? { clienteId: data.clienteId } : {}),
                ...(data.cep !== undefined ? { cep: data.cep } : {}),
                ...(data.logradouro !== undefined ? { logradouro: data.logradouro } : {}),
                ...(data.numero !== undefined ? { numero: data.numero } : {}),
                ...(data.complemento !== undefined ? { complemento: data.complemento } : {}),
                ...(data.bairro !== undefined ? { bairro: data.bairro } : {}),
                ...(data.cidade !== undefined ? { cidade: data.cidade } : {}),
                ...(data.estado !== undefined ? { estado: data.estado } : {}),
                ...(data.pais !== undefined ? { pais: data.pais } : {}),
            };
            return await prisma.address.update({
                where: { id },
                data: addressData,
                include: { cliente: true },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new AppError('Cliente não encontrado', 404);
            }
            throw error;
        }
    }

    async deleteAddress(id: string): Promise<boolean> {
        try {
            await prisma.address.delete({ where: { id } });
            return true;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return false;
            }
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
                throw new AppError('Não é possível excluir um endereço que possui pacotes', 409);
            }
            throw error;
        }
    }
}