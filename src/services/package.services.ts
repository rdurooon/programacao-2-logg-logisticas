import { z } from "zod";
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateTrackingCode } from "@/utils/codes";
import { AppError } from '@/types';

export const packageSchema = z.object({
    description: z.string().min(1, "Descrição é necessaria"),
    dimensions: z.string().min(1, "Dimensões são necessarias"),
    weight: z.number().positive("O peso deve ser um número positivo"),
    clienteId: z.string(),
    addressId: z.string()
});

export const packageUpdateSchema = packageSchema.partial();
export type Package = Prisma.PackageGetPayload<{}>;
export type PackageInput = z.infer<typeof packageSchema>;
export type PackageUpdateInput = z.infer<typeof packageUpdateSchema>;

export class PackageService {
    public async getAllPackages(params: {
        page?: number;
        limit?: number;
        where?: string;
        orderBy?: Prisma.PackageOrderByWithRelationInput | Prisma.PackageOrderByWithRelationInput[];
    }): Promise<any> {
        const { page = 1, limit = 10} = params;
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
        const skip = (safePage - 1) * safeLimit;
        const search = params.where?.trim();
        const where: Prisma.PackageWhereInput = search ? {
            OR: ['code', 'description', 'dimensions', 'status'].map((field) => ({
                [field]: { contains: search, mode: 'insensitive' }
            }))
        } : {};
        const orderBy = params.orderBy ?? { createdAt: 'desc' as const };
        const packages = await prisma.package.findMany({
            skip,
            take: safeLimit,
            where,
            orderBy
        });
        return packages;
    }

    public async getPackageById(id: string): Promise<Package | null> {
        const packageRecord = await prisma.package.findUnique({
            where: { id }
        })
        return packageRecord;
    }

    public async addPackage(packageData: PackageInput): Promise<Package> {
        const address = await prisma.address.findFirst({
            where: { id: packageData.addressId, clienteId: packageData.clienteId },
            select: { id: true },
        });
        if (!address) {
            throw new AppError('O endereço não pertence ao cliente informado', 400);
        }
        const newPackage = await prisma.package.create({
            data: {
                ...packageData,
                code: await generateTrackingCode(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });
        return newPackage as Package;
    }

    public async updatePackage(
        id: string,
        packageData: PackageUpdateInput
    ): Promise<Package | null> {
        try {
            const currentPackage = await prisma.package.findUnique({ where: { id } });
            if (!currentPackage) return null;

            const clienteId = packageData.clienteId ?? currentPackage.clienteId;
            const addressId = packageData.addressId ?? currentPackage.addressId;
            const address = await prisma.address.findFirst({
                where: { id: addressId, clienteId },
                select: { id: true },
            });
            if (!address) {
                throw new AppError('O endereço não pertence ao cliente informado', 400);
            }

            const updateData: Prisma.PackageUncheckedUpdateInput = {
                ...(packageData.description !== undefined ? { description: packageData.description } : {}),
                ...(packageData.dimensions !== undefined ? { dimensions: packageData.dimensions } : {}),
                ...(packageData.weight !== undefined ? { weight: packageData.weight } : {}),
                ...(packageData.clienteId !== undefined ? { clienteId: packageData.clienteId } : {}),
                ...(packageData.addressId !== undefined ? { addressId: packageData.addressId } : {}),
                updatedAt: new Date(),
            };
            const updatedPackage = await prisma.package.update({
                where: { id },
                data: updateData,
            });
            return updatedPackage;
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return null;
            }
            throw error;
        }
    }

    public async deletePackage(id: string): Promise<boolean> {
        try {
            await prisma.package.delete({ where: { id } });
            return true;
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return false;
            }
            throw error;
        }
    }
}