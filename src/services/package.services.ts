import { z } from "zod";
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateTrackingCode } from "@/utils/codes";
import { AppError, AuthUser, UserRole } from '@/types';

export const packageStatuses = [
    'Pendente',
    'Coletado',
    'Em trânsito',
    'Em rota de entrega',
    'Entregue',
    'Cancelado',
] as const;

const nextStatuses: Record<string, string[]> = {
    'Pendente': ['Coletado', 'Cancelado'],
    'Coletado': ['Em trânsito', 'Cancelado'],
    'Em trânsito': ['Em rota de entrega', 'Cancelado'],
    'Em rota de entrega': ['Cancelado'],
    'Entregue': [],
    'Cancelado': [],
};

export const packageSchema = z.object({
    description: z.string().min(1, "Descrição é necessaria"),
    dimensions: z.string().min(1, "Dimensões são necessarias"),
    weight: z.number().positive("O peso deve ser um número positivo"),
    clienteId: z.string().optional(),
    originAddressId: z.string().min(1, 'Endereço de origem é obrigatório'),
    addressId: z.string().min(1, 'Endereço de destino é obrigatório'),
});

export const packageUpdateSchema = packageSchema.partial();
export const packageStatusSchema = z.object({ status: z.enum(['Coletado', 'Em trânsito', 'Em rota de entrega']) });
export const packageCourierSchema = z.object({ courierId: z.string().min(1) });
export const nearbyOfferSchema = z.object({
    radiusMeters: z.number().positive().max(100_000).optional(),
    limit: z.number().int().positive().max(20).optional(),
});
export const packageLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});
export const packageIncidentSchema = z.object({
    description: z.string().trim().min(5).max(2000),
    photo: z.string().max(11_200_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
});
export const packageCancelSchema = z.object({ reason: z.string().trim().min(3).max(500) });
export const offerResponseSchema = z.object({ accepted: z.boolean() });
export type Package = Prisma.PackageGetPayload<{}>;
export type PackageInput = z.infer<typeof packageSchema>;
export type PackageUpdateInput = z.infer<typeof packageUpdateSchema>;

const activeStatuses = ['Pendente', 'Coletado', 'Em trânsito', 'Em rota de entrega'];
const locationStatuses = ['Coletado', 'Em trânsito', 'Em rota de entrega'];
const managerRoles = [UserRole.ADMIN, UserRole.LOGISTICS_MANAGER];

function isManager(user: AuthUser): boolean {
    return user.roles.some((role) => managerRoles.includes(role));
}

async function createNotifications(
    transaction: Prisma.TransactionClient,
    packageId: string,
    userIds: (string | null | undefined)[],
    title: string,
    message: string,
) {
    const uniqueUserIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (uniqueUserIds.length === 0) return;
    await transaction.userNotification.createMany({
        data: uniqueUserIds.map((userId) => ({ userId, packageId, title, message })),
    });
}

function validatePhoto(photo: string): void {
    const [, mimeType, encoded] = photo.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/) ?? [];
    if (!mimeType || !encoded) {
        throw new AppError('A evidência deve ser uma imagem JPEG, PNG ou WebP em Base64', 400);
    }
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length > 8 * 1024 * 1024) {
        throw new AppError('A imagem deve ter no máximo 8 MB', 413);
    }
    const validSignature = mimeType === 'jpeg'
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : mimeType === 'png'
            ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!validSignature) {
        throw new AppError('O conteúdo enviado não corresponde ao formato da imagem', 400);
    }
}

function distanceInMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = radians(latitudeB - latitudeA);
    const longitudeDelta = radians(longitudeB - longitudeA);
    const value = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export class PackageService {
    public async getAllPackages(params: {
        page?: number;
        limit?: number;
        where?: string;
        user: AuthUser;
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
        if (params.user.roles.includes(UserRole.COURIER)) {
            where.courierId = params.user.id;
        } else if (params.user.roles.includes(UserRole.CUSTOMER)) {
            where.cliente = { is: { userId: params.user.id } };
        } else if (!params.user.roles.some((role) => [UserRole.ADMIN, UserRole.LOGISTICS_MANAGER].includes(role))) {
            throw new AppError('Sem permissão para consultar entregas', 403);
        }
        const orderBy = params.orderBy ?? { createdAt: 'desc' as const };
        const packages = await prisma.package.findMany({
            skip,
            take: safeLimit,
            where,
            orderBy,
            include: { events: { orderBy: { createdAt: 'asc' } } },
        });
        if (params.user.roles.includes(UserRole.CUSTOMER)) {
            return packages.map((packageRecord) => ({
                ...packageRecord,
                events: packageRecord.events.map(({ status, createdAt }) => ({ status, createdAt })),
            }));
        }
        return packages;
    }

    public async getPackageById(id: string, user: AuthUser) {
        const where: Prisma.PackageWhereInput = { id };
        if (user.roles.includes(UserRole.COURIER)) {
            where.courierId = user.id;
        } else if (user.roles.includes(UserRole.CUSTOMER)) {
            where.cliente = { is: { userId: user.id } };
        } else if (!user.roles.some((role) => [UserRole.ADMIN, UserRole.LOGISTICS_MANAGER].includes(role))) {
            throw new AppError('Sem permissão para consultar entregas', 403);
        }
        const packageRecord = await prisma.package.findFirst({
            where,
            include: { events: { orderBy: { createdAt: 'asc' } } },
        });
        if (packageRecord && user.roles.includes(UserRole.CUSTOMER)) {
            return {
                ...packageRecord,
                events: packageRecord.events.map(({ status, createdAt }) => ({ status, createdAt })),
            };
        }
        return packageRecord;
    }

    public async getPackageByCode(code: string) {
        const packageRecord = await prisma.package.findUnique({
            where: { code },
            select: {
                id: true,
                courierId: true,
                code: true,
                description: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                events: { select: { status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
            },
        });
        if (!packageRecord) return null;
        const latestLocation = packageRecord.status === 'Em rota de entrega' && packageRecord.courierId
            ? await prisma.packageLocation.findFirst({
            where: { packageId: packageRecord.id, courierId: packageRecord.courierId },
                orderBy: { recordedAt: 'desc' },
                select: { latitude: true, longitude: true, recordedAt: true },
            })
            : null;
        const maxAgeSeconds = Math.max(30, Number(process.env.DELIVERY_LOCATION_MAX_AGE_SECONDS) || 300);
        const location = latestLocation && Date.now() - latestLocation.recordedAt.getTime() <= maxAgeSeconds * 1000
            ? latestLocation
            : null;
        const { id: _id, courierId: _courierId, ...publicPackage } = packageRecord;
        return { ...publicPackage, location };
    }

    public async addPackage(packageData: PackageInput, user: AuthUser) {
        let clienteId = packageData.clienteId;
        if (user.roles.includes(UserRole.CUSTOMER)) {
            const cliente = await prisma.cliente.findUnique({
                where: { userId: user.id },
                select: { id: true },
            });
            if (!cliente || (clienteId && clienteId !== cliente.id)) {
                throw new AppError('Cliente vinculado à conta não encontrado', 403);
            }
            clienteId = cliente.id;
        } else if (!user.roles.some((role) => [UserRole.ADMIN, UserRole.LOGISTICS_MANAGER].includes(role))) {
            throw new AppError('Sem permissão para cadastrar entregas', 403);
        }
        if (!clienteId) {
            throw new AppError('Cliente é obrigatório', 400);
        }
        const addressIds = [...new Set([packageData.originAddressId, packageData.addressId])];
        const addresses = await prisma.address.findMany({
            where: { id: { in: addressIds }, clienteId },
            select: { id: true },
        });
        if (addresses.length !== addressIds.length) {
            throw new AppError('Origem e destino devem pertencer ao cliente', 400);
        }

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                return await prisma.$transaction(async (transaction) => {
                    const created = await transaction.package.create({
                        data: {
                            description: packageData.description,
                            dimensions: packageData.dimensions,
                            weight: packageData.weight,
                            clienteId,
                            addressId: packageData.addressId,
                            originAddressId: packageData.originAddressId,
                            code: await generateTrackingCode(),
                            status: 'Pendente',
                            events: { create: { status: 'Pendente', actorId: user.id } },
                        },
                        include: { events: { orderBy: { createdAt: 'asc' } } },
                    });
                    const managers = await transaction.user.findMany({
                        where: { roles: { some: { name: { in: managerRoles } } } },
                        select: { id: true },
                    });
                    await createNotifications(
                        transaction,
                        created.id,
                        managers.map((manager) => manager.id),
                        'Nova entrega cadastrada',
                        `A entrega ${created.code} está aguardando atribuição.`,
                    );
                    return created;
                });
            } catch (error) {
                if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
                    throw error;
                }
            }
        }
        throw new AppError('Não foi possível gerar um código de rastreio único', 503);
    }

    public async updatePackage(
        id: string,
        packageData: PackageUpdateInput
    ): Promise<Package | null> {
        try {
            const currentPackage = await prisma.package.findUnique({ where: { id } });
            if (!currentPackage) return null;
            if (currentPackage.status !== 'Pendente') {
                throw new AppError('Somente entregas pendentes podem ser editadas', 409);
            }

            const clienteId = packageData.clienteId ?? currentPackage.clienteId;
            const addressId = packageData.addressId ?? currentPackage.addressId;
            const originAddressId = packageData.originAddressId ?? currentPackage.originAddressId;
            const addressIds = [...new Set([addressId, originAddressId].filter((value): value is string => Boolean(value)))];
            const addresses = await prisma.address.findMany({
                where: { id: { in: addressIds }, clienteId },
                select: { id: true },
            });
            if (addresses.length !== addressIds.length) {
                throw new AppError('Origem e destino devem pertencer ao cliente', 400);
            }

            const updateData: Prisma.PackageUncheckedUpdateInput = {
                ...(packageData.description !== undefined ? { description: packageData.description } : {}),
                ...(packageData.dimensions !== undefined ? { dimensions: packageData.dimensions } : {}),
                ...(packageData.weight !== undefined ? { weight: packageData.weight } : {}),
                ...(packageData.clienteId !== undefined ? { clienteId: packageData.clienteId } : {}),
                ...(packageData.addressId !== undefined ? { addressId: packageData.addressId } : {}),
                ...(packageData.originAddressId !== undefined ? { originAddressId: packageData.originAddressId } : {}),
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

    public async updateStatus(id: string, status: string, user: AuthUser) {
        const packageRecord = await prisma.package.findUnique({
            where: { id },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) return null;
        const isManager = user.roles.some((role) => [UserRole.ADMIN, UserRole.LOGISTICS_MANAGER].includes(role));
        if (!isManager && (!user.roles.includes(UserRole.COURIER) || packageRecord.courierId !== user.id)) {
            throw new AppError('Sem permissão para atualizar esta entrega', 403);
        }
        if (!nextStatuses[packageRecord.status]?.includes(status)) {
            throw new AppError('Transição de status inválida', 409);
        }

        return prisma.$transaction(async (transaction) => {
            const updateWhere: Prisma.PackageWhereInput = { id, status: packageRecord.status };
            if (!isManager) updateWhere.courierId = user.id;
            const updated = await transaction.package.updateMany({
                where: updateWhere,
                data: { status, updatedAt: new Date() },
            });
            if (updated.count !== 1) {
                throw new AppError('A entrega foi alterada por outra operação; atualize e tente novamente', 409);
            }
            await transaction.packageEvent.create({ data: { packageId: id, status, actorId: user.id } });
            await createNotifications(
                transaction,
                id,
                [packageRecord.cliente.userId],
                'Atualização da entrega',
                `O status da entrega foi atualizado para ${status}.`,
            );
            return transaction.package.findUnique({
                where: { id },
                include: { events: { orderBy: { createdAt: 'asc' } } },
            });
        });
    }

    public async assignCourier(id: string, courierId: string, actor: AuthUser) {
        if (!isManager(actor)) throw new AppError('Sem permissão para atribuir entregadores', 403);
        const packageRecord = await prisma.package.findUnique({
            where: { id },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) return null;
        if (!activeStatuses.includes(packageRecord.status)) {
            throw new AppError('Entregas concluídas ou canceladas não podem ser atribuídas', 409);
        }
        const courier = await prisma.user.findFirst({
            where: { id: courierId, roles: { some: { name: UserRole.COURIER } } },
            select: { id: true },
        });
        if (!courier) {
            throw new AppError('Entregador não encontrado ou sem perfil de entregador', 404);
        }
        if (packageRecord.courierId === courierId) {
            throw new AppError('Este entregador já está atribuído à entrega', 409);
        }
        return prisma.$transaction(async (transaction) => {
            const assigned = await transaction.package.updateMany({
                where: { id, status: packageRecord.status, courierId: packageRecord.courierId },
                data: { courierId },
            });
            if (assigned.count !== 1) {
                throw new AppError('A entrega foi alterada por outra operação; atualize e tente novamente', 409);
            }
            await transaction.packageOffer.updateMany({
                where: { packageId: id, status: 'PENDING' },
                data: { status: 'WITHDRAWN', respondedAt: new Date() },
            });
            if (packageRecord.courierId) {
                await transaction.packageOffer.updateMany({
                    where: { packageId: id, courierId: packageRecord.courierId, status: 'ACCEPTED' },
                    data: { status: 'WITHDRAWN', respondedAt: new Date() },
                });
            }
            await transaction.packageEvent.create({
                data: { packageId: id, status: packageRecord.status, actorId: actor.id, details: `Entregador atribuído: ${courierId}` },
            });
            await createNotifications(
                transaction,
                id,
                [packageRecord.cliente.userId, packageRecord.courierId, courierId],
                'Entregador atualizado',
                'A entrega foi atribuída ou reatribuída.',
            );
            return transaction.package.findUnique({
                where: { id },
                include: { events: { orderBy: { createdAt: 'asc' } } },
            });
        });
    }

    public async createOffer(packageId: string, courierId: string, actor: AuthUser) {
        if (!isManager(actor)) throw new AppError('Sem permissão para ofertar entregas', 403);
        const packageRecord = await prisma.package.findUnique({
            where: { id: packageId },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) return null;
        if (!activeStatuses.includes(packageRecord.status)) {
            throw new AppError('Entrega concluída ou cancelada não pode ser ofertada', 409);
        }
        if (packageRecord.courierId === courierId) {
            throw new AppError('O entregador informado já está atribuído', 409);
        }
        const courier = await prisma.user.findFirst({
            where: { id: courierId, roles: { some: { name: UserRole.COURIER } } },
            select: { id: true },
        });
        if (!courier) throw new AppError('Entregador não encontrado', 404);
        const pendingOffer = await prisma.packageOffer.findFirst({
            where: { packageId, courierId, status: 'PENDING' },
            select: { id: true },
        });
        if (pendingOffer) throw new AppError('Já existe uma oferta pendente para este entregador', 409);

        return prisma.$transaction(async (transaction) => {
            const offer = await transaction.packageOffer.create({
                data: { packageId, courierId },
                include: { package: { select: { id: true, code: true, description: true, status: true } } },
            });
            await createNotifications(
                transaction,
                packageId,
                [courierId],
                'Nova oferta de entrega',
                `A entrega ${packageRecord.code} está disponível para aceite.`,
            );
            return offer;
        });
    }

    public async createNearbyOffers(
        packageId: string,
        actor: AuthUser,
        radiusMeters = 5_000,
        limit = 3,
    ) {
        if (!isManager(actor)) throw new AppError('Sem permissão para ofertar entregas', 403);
        const packageRecord = await prisma.package.findUnique({
            where: { id: packageId },
            include: {
                originAddress: { select: { latitude: true, longitude: true } },
            },
        });
        if (!packageRecord) return null;
        if (packageRecord.status !== 'Pendente') {
            throw new AppError('Ofertas por proximidade só podem ser criadas para entregas pendentes', 409);
        }
        const origin = packageRecord.originAddress;
        if (origin?.latitude === null || origin?.latitude === undefined || origin.longitude === null) {
            throw new AppError('A origem precisa ter coordenadas cadastradas', 409);
        }
        return this.findNearbyOffers(packageRecord, actor, origin, radiusMeters, limit);
    }

    private async findNearbyOffers(
        packageRecord: Prisma.PackageGetPayload<{ include: { originAddress: { select: { latitude: true; longitude: true } } } }>,
        actor: AuthUser,
        origin: { latitude: number | null; longitude: number | null },
        radiusMeters: number,
        limit: number,
    ) {
        const cutoff = new Date(Date.now() - 10 * 60 * 1000);
        const recentLocations = await prisma.courierLocation.findMany({
            where: {
                updatedAt: { gte: cutoff },
                courier: {
                    is: {
                        roles: { some: { name: UserRole.COURIER } },
                        assignedPackages: { none: { status: { in: activeStatuses } } },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
            select: { courierId: true, latitude: true, longitude: true },
        });
        const candidates = recentLocations.flatMap((location) => {
            if (location.courierId === packageRecord.courierId) return [];
            const distanceMeters = distanceInMeters(
                origin.latitude!,
                origin.longitude!,
                location.latitude,
                location.longitude,
            );
            return distanceMeters <= radiusMeters ? [{ courierId: location.courierId, distanceMeters }] : [];
        }).slice(0, limit);
        if (candidates.length === 0) return [];

        const pendingOffers = await prisma.packageOffer.findMany({
            where: { packageId: packageRecord.id, status: 'PENDING', courierId: { in: candidates.map(({ courierId }) => courierId) } },
            select: { courierId: true },
        });
        const existingCourierIds = new Set(pendingOffers.map(({ courierId }) => courierId));
        const newCandidates = candidates.filter(({ courierId }) => !existingCourierIds.has(courierId));
        return prisma.$transaction(async (transaction) => {
            const createdOffers = [];
            for (const candidate of newCandidates) {
                const offer = await transaction.packageOffer.create({
                    data: { packageId: packageRecord.id, courierId: candidate.courierId },
                });
                createdOffers.push({ ...offer, distanceMeters: Math.round(candidate.distanceMeters) });
            }
            await createNotifications(
                transaction,
                packageRecord.id,
                newCandidates.map(({ courierId }) => courierId),
                'Nova oferta de entrega',
                `A entrega ${packageRecord.code} está disponível para aceite.`,
            );
            await transaction.packageEvent.create({
                data: {
                    packageId: packageRecord.id,
                    status: packageRecord.status,
                    actorId: actor.id,
                    details: `Oferta enviada a ${createdOffers.length} entregador(es) próximos`,
                },
            });
            return createdOffers;
        });
    }

    public async getOffers(user: AuthUser) {
        if (!user.roles.includes(UserRole.COURIER) && !isManager(user)) {
            throw new AppError('Sem permissão para consultar ofertas', 403);
        }
        return prisma.packageOffer.findMany({
            where: {
                status: 'PENDING',
                ...(user.roles.includes(UserRole.COURIER) ? { courierId: user.id } : {}),
            },
            orderBy: { createdAt: 'asc' },
            take: 100,
            include: {
                package: { select: { id: true, code: true, description: true, status: true } },
                courier: { select: { id: true, name: true } },
            },
        });
    }

    public async respondToOffer(offerId: string, user: AuthUser, accepted: boolean) {
        if (!user.roles.includes(UserRole.COURIER)) {
            throw new AppError('Somente entregadores podem responder ofertas', 403);
        }
        const offer = await prisma.packageOffer.findFirst({
            where: { id: offerId, courierId: user.id, status: 'PENDING' },
            include: { package: { include: { cliente: { select: { userId: true } } } } },
        });
        if (!offer) return null;
        if (!accepted) {
            const managers = await prisma.user.findMany({
                where: { roles: { some: { name: { in: managerRoles } } } },
                select: { id: true },
            });
            return prisma.$transaction(async (transaction) => {
                const result = await transaction.packageOffer.updateMany({
                    where: { id: offerId, courierId: user.id, status: 'PENDING' },
                    data: { status: 'REJECTED', respondedAt: new Date() },
                });
                if (result.count !== 1) return null;
                await transaction.packageEvent.create({
                    data: {
                        packageId: offer.packageId,
                        status: offer.package.status,
                        actorId: user.id,
                        details: `Oferta recusada pelo entregador ${user.id}`,
                    },
                });
                await createNotifications(
                    transaction,
                    offer.packageId,
                    [offer.package.cliente.userId, ...managers.map(({ id }) => id)],
                    'Oferta recusada',
                    `A oferta para a entrega ${offer.package.code} foi recusada.`,
                );
                return { id: offerId, status: 'REJECTED' };
            });
        }
        if (!activeStatuses.includes(offer.package.status)) {
            throw new AppError('A entrega não está mais disponível', 409);
        }

        return prisma.$transaction(async (transaction) => {
            const acceptedOffer = await transaction.packageOffer.updateMany({
                where: { id: offerId, courierId: user.id, status: 'PENDING' },
                data: { status: 'ACCEPTED', respondedAt: new Date() },
            });
            if (acceptedOffer.count !== 1) {
                throw new AppError('A oferta já foi respondida', 409);
            }
            const assigned = await transaction.package.updateMany({
                where: {
                    id: offer.packageId,
                    status: { in: activeStatuses },
                    courierId: offer.package.courierId,
                },
                data: { courierId: user.id },
            });
            if (assigned.count !== 1) {
                throw new AppError('A entrega foi alterada por outra operação', 409);
            }
            if (offer.package.courierId) {
                await transaction.packageOffer.updateMany({
                    where: { packageId: offer.packageId, courierId: offer.package.courierId, status: 'ACCEPTED' },
                    data: { status: 'WITHDRAWN', respondedAt: new Date() },
                });
            }
            await transaction.packageOffer.updateMany({
                where: { packageId: offer.packageId, id: { not: offerId }, status: 'PENDING' },
                data: { status: 'WITHDRAWN', respondedAt: new Date() },
            });
            await transaction.packageEvent.create({
                data: {
                    packageId: offer.packageId,
                    status: offer.package.status,
                    actorId: user.id,
                    details: `Oferta aceita pelo entregador ${user.id}`,
                },
            });
            await createNotifications(
                transaction,
                offer.packageId,
                [offer.package.cliente.userId, offer.package.courierId, user.id],
                'Entregador confirmado',
                `A entrega ${offer.package.code} foi aceita e atribuída.`,
            );
            return transaction.packageOffer.findUnique({
                where: { id: offerId },
                include: { package: { select: { id: true, code: true, status: true } } },
            });
        });
    }

    public async updateLocation(packageId: string, coordinates: z.infer<typeof packageLocationSchema>, user: AuthUser) {
        if (!user.roles.includes(UserRole.COURIER)) {
            throw new AppError('Somente entregadores podem enviar localização', 403);
        }
        const packageRecord = await prisma.package.findUnique({ where: { id: packageId } });
        if (!packageRecord) return null;
        if (packageRecord.courierId !== user.id || !locationStatuses.includes(packageRecord.status)) {
            throw new AppError('A entrega não está atribuída a este entregador ou não permite localização', 403);
        }
        return prisma.$transaction(async (transaction) => {
            const location = await transaction.packageLocation.create({
                data: { packageId, courierId: user.id, ...coordinates },
                select: { id: true, latitude: true, longitude: true, recordedAt: true },
            });
            await transaction.courierLocation.upsert({
                where: { courierId: user.id },
                create: { courierId: user.id, ...coordinates },
                update: coordinates,
            });
            return location;
        });
    }

    public async updateCourierLocation(coordinates: z.infer<typeof packageLocationSchema>, user: AuthUser) {
        if (!user.roles.includes(UserRole.COURIER)) {
            throw new AppError('Somente entregadores podem atualizar sua localização', 403);
        }
        return prisma.courierLocation.upsert({
            where: { courierId: user.id },
            create: { courierId: user.id, ...coordinates },
            update: coordinates,
            select: { latitude: true, longitude: true, updatedAt: true },
        });
    }

    public async getLocation(packageId: string, user: AuthUser) {
        const packageRecord = await prisma.package.findUnique({
            where: { id: packageId },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) throw new AppError('Entrega não encontrada', 404);
        const customerOwnsPackage = user.roles.includes(UserRole.CUSTOMER)
            && packageRecord.cliente.userId === user.id;
        const assignedCourier = user.roles.includes(UserRole.COURIER)
            && packageRecord.courierId === user.id;
        if (!isManager(user) && !customerOwnsPackage && !assignedCourier) {
            throw new AppError('Sem permissão para consultar esta localização', 403);
        }
        if (customerOwnsPackage && packageRecord.status !== 'Em rota de entrega') {
            return null;
        }
        if (!packageRecord.courierId) return null;
        const location = await prisma.packageLocation.findFirst({
            where: { packageId, courierId: packageRecord.courierId },
            orderBy: { recordedAt: 'desc' },
            select: { latitude: true, longitude: true, recordedAt: true },
        });
        if (customerOwnsPackage && location) {
            const maxAgeSeconds = Math.max(30, Number(process.env.DELIVERY_LOCATION_MAX_AGE_SECONDS) || 300);
            if (Date.now() - location.recordedAt.getTime() > maxAgeSeconds * 1000) return null;
        }
        return location;
    }

    public async createIncident(packageId: string, input: z.infer<typeof packageIncidentSchema>, user: AuthUser) {
        validatePhoto(input.photo);
        const packageRecord = await prisma.package.findUnique({
            where: { id: packageId },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) return null;
        const assignedCourier = user.roles.includes(UserRole.COURIER) && packageRecord.courierId === user.id;
        if (!isManager(user) && !assignedCourier) {
            throw new AppError('Sem permissão para registrar ocorrência nesta entrega', 403);
        }
        if (!activeStatuses.includes(packageRecord.status)) {
            throw new AppError('Não é possível registrar ocorrência em entrega encerrada', 409);
        }
        const managers = await prisma.user.findMany({
            where: { roles: { some: { name: { in: managerRoles } } } },
            select: { id: true },
        });
        const evidenceData = input.photo;
        const incident = await prisma.$transaction(async (transaction) => {
            const created = await transaction.packageIncident.create({
                data: { packageId, reporterId: user.id, description: input.description, evidenceData },
                select: { id: true, packageId: true, reporterId: true, description: true, createdAt: true },
            });
            await createNotifications(
                transaction,
                packageId,
                [packageRecord.cliente.userId, ...managers.map((manager) => manager.id)],
                'Ocorrência registrada',
                input.description,
            );
            return created;
        });
        return incident;
    }

    public async getIncidents(packageId: string, user: AuthUser) {
        const packageRecord = await prisma.package.findUnique({
            where: { id: packageId },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) return null;
        const customerOwnsPackage = user.roles.includes(UserRole.CUSTOMER)
            && packageRecord.cliente.userId === user.id;
        const assignedCourier = user.roles.includes(UserRole.COURIER)
            && packageRecord.courierId === user.id;
        if (!isManager(user) && !customerOwnsPackage && !assignedCourier) {
            throw new AppError('Sem permissão para consultar ocorrências', 403);
        }
        return prisma.packageIncident.findMany({
            where: { packageId },
            orderBy: { createdAt: 'asc' },
            select: { id: true, description: true, evidenceData: true, createdAt: true },
        });
    }

    public async confirmDelivery(packageId: string, user: AuthUser) {
        if (!user.roles.includes(UserRole.COURIER)) {
            throw new AppError('Somente o entregador atribuído pode confirmar a entrega', 403);
        }
        const packageRecord = await prisma.package.findUnique({
            where: { id: packageId },
            include: {
                cliente: { select: { userId: true } },
                address: { select: { latitude: true, longitude: true } },
            },
        });
        if (!packageRecord) return null;
        if (packageRecord.courierId !== user.id || packageRecord.status !== 'Em rota de entrega') {
            throw new AppError('A entrega precisa estar em rota e atribuída a este entregador', 409);
        }
        if (packageRecord.address.latitude === null || packageRecord.address.longitude === null) {
            throw new AppError('O destino precisa ter coordenadas cadastradas', 409);
        }
        const location = await prisma.packageLocation.findFirst({
            where: { packageId, courierId: user.id },
            orderBy: { recordedAt: 'desc' },
        });
        if (!location) throw new AppError('Nenhuma localização recente foi registrada', 409);
        const maxAgeSeconds = Math.max(30, Number(process.env.DELIVERY_LOCATION_MAX_AGE_SECONDS) || 300);
        if (Date.now() - location.recordedAt.getTime() > maxAgeSeconds * 1000) {
            throw new AppError('A última localização está desatualizada', 409);
        }
        const configuredRadius = Number(process.env.DELIVERY_CONFIRMATION_RADIUS_METERS);
        const radiusMeters = Number.isFinite(configuredRadius) && configuredRadius > 0 ? configuredRadius : 100;
        const distance = distanceInMeters(
            location.latitude,
            location.longitude,
            packageRecord.address.latitude,
            packageRecord.address.longitude,
        );
        if (distance > radiusMeters) {
            throw new AppError(`O entregador está fora do raio permitido de ${radiusMeters} metros`, 409);
        }

        return prisma.$transaction(async (transaction) => {
            const updated = await transaction.package.updateMany({
                where: { id: packageId, courierId: user.id, status: 'Em rota de entrega' },
                data: { status: 'Entregue', updatedAt: new Date() },
            });
            if (updated.count !== 1) throw new AppError('A entrega foi alterada por outra operação', 409);
            await transaction.packageEvent.create({
                data: { packageId, status: 'Entregue', actorId: user.id, details: `Entrega confirmada a ${Math.round(distance)} metros do destino` },
            });
            await createNotifications(
                transaction,
                packageId,
                [packageRecord.cliente.userId],
                'Entrega concluída',
                `A entrega ${packageRecord.code} foi confirmada no destino.`,
            );
            return transaction.package.findUnique({
                where: { id: packageId },
                include: { events: { orderBy: { createdAt: 'asc' } } },
            });
        });
    }

    public async getNotifications(userId: string, page = 1, limit = 20) {
        const safePage = Number.isInteger(page) && page > 0 ? page : 1;
        const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20;
        return prisma.userNotification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
        });
    }

    public async markNotificationRead(id: string, userId: string): Promise<boolean> {
        const result = await prisma.userNotification.updateMany({
            where: { id, userId, readAt: null },
            data: { readAt: new Date() },
        });
        return result.count === 1;
    }

    public async deletePackage(id: string, user: AuthUser, reason: string): Promise<boolean> {
        const packageRecord = await prisma.package.findUnique({
            where: { id },
            include: { cliente: { select: { userId: true } } },
        });
        if (!packageRecord) return false;
        if (!isManager(user) && (!user.roles.includes(UserRole.COURIER) || packageRecord.courierId !== user.id)) {
            throw new AppError('Sem permissão para cancelar esta entrega', 403);
        }
        if (!nextStatuses[packageRecord.status]?.includes('Cancelado')) {
            throw new AppError('Esta entrega não pode mais ser cancelada', 409);
        }

        return prisma.$transaction(async (transaction) => {
            const updateWhere: Prisma.PackageWhereInput = { id, status: packageRecord.status };
            if (!isManager(user)) updateWhere.courierId = user.id;
            const updated = await transaction.package.updateMany({
                where: updateWhere,
                data: { status: 'Cancelado', updatedAt: new Date() },
            });
            if (updated.count !== 1) {
                throw new AppError('A entrega foi alterada por outra operação; atualize e tente novamente', 409);
            }
            await transaction.packageEvent.create({
                data: { packageId: id, status: 'Cancelado', details: reason, actorId: user.id },
            });
            await transaction.packageOffer.updateMany({
                where: { packageId: id, status: 'PENDING' },
                data: { status: 'WITHDRAWN', respondedAt: new Date() },
            });
            await transaction.packageOffer.updateMany({
                where: { packageId: id, status: 'ACCEPTED' },
                data: { status: 'WITHDRAWN', respondedAt: new Date() },
            });
            await createNotifications(
                transaction,
                id,
                [packageRecord.cliente.userId, packageRecord.courierId],
                'Entrega cancelada',
                reason,
            );
            return true;
        });
    }
}