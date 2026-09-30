import { z } from "zod";
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateTrackingCode } from "@/utils/codes";

export const packageSchema = z.object({
    id: z.string().optional(),
    code: z.string().min(1, "Código é necessario"),
    description: z.string().min(1, "Descrição é necessaria"),
    dimensions: z.string().min(1, "Dimensões são necessarias"),
    weight: z.number().positive("O peso deve ser um número positivo"),
    userId: z.string(),
    addressId: z.string()
});

export type Package = z.infer<typeof packageSchema>;

export class PackageService {
    public async getAllPackages(params: {
        page?: number;
        limit?: number;
        where?: Partial<Package>;
        orderBy?: {[key: string]: 'asc' | 'desc'};
    }): Promise<any> {
        const { page = 1, limit = 10} = params;
        const skip = (page - 1) * limit || 0;
        const where = params.where ? {
            OR: Object.entries(params.where).map(([key, value]) => ({
                [key]: { contains: value, mode: 'insensitive' },
            }))
        } : {};
        const orderBy = params.orderBy ? Object.entries(params.orderBy).map(([key,value]) => ({
            [key]: {
                [value]: value === 'asc' ? 'asc' : 'desc'
            }
        })) : {
            createAt: 'desc' as const
        };
        const packages = await prisma.package.findMany({
            skip,
            take: limit || 10,
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

    public async addPackage(packageData: Omit<Package, "id" | "createdAt" | "updatedAt">): Promise<Package> {
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
        packageData: Partial<Omit<Package, "id" | "createdAt" | "updatedAt" | "code">>
    ): Promise<Package | null> {
        const updatedPackage = await prisma.package.update({
            where: { id },
            data: {
                ...packageData,
                updatedAt: new Date()
            }
        });
        return updatedPackage;
    }

    public async deletePackage(id: string): Promise<boolean> {
        await prisma.package.delete({
            where: { id }
        });
        return true;
    }
}