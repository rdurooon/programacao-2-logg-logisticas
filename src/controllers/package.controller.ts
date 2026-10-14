import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '@/types';
import {
    PackageService,
    nearbyOfferSchema,
    offerResponseSchema,
    packageCancelSchema,
    packageCourierSchema,
    packageIncidentSchema,
    packageLocationSchema,
    packageSchema,
    packageStatusSchema,
    packageUpdateSchema,
} from '@/services/package.services';

export class PackageController {
    private packageService: PackageService;

    constructor() {
        this.packageService = new PackageService();
    }

    public getAllPackages = async (req: Request, res: Response): Promise<void> => {
        try {
            const { page, limit, q } = req.query;
            const packages = await this.packageService.getAllPackages({
                ...(typeof page === 'string' ? { page: Number(page) } : {}),
                ...(typeof limit === 'string' ? { limit: Number(limit) } : {}),
                ...(typeof q === 'string' ? { where: q } : {}),
                user: req.user!,
            });
            res.status(200).json(packages);
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar entregas');
        }
    };

    public getPackageById = async (req: Request, res: Response): Promise<void> => {
        try {
            const packageId = req.params.id as string;
            const foundPackage = await this.packageService.getPackageById(packageId, req.user!);
            if (foundPackage) {
                res.status(200).json(foundPackage);
            } else {
                res.status(404).json({ message: 'Package not found'})
            }
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar entrega');
        }
    };

    public getPackageByCode = async (req: Request, res: Response): Promise<void> => {
        try {
            const packageRecord = await this.packageService.getPackageByCode(req.params.code as string);
            if (!packageRecord) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(200).json(packageRecord);
        } catch (error) {
            this.handleError(res, error, 'Erro ao consultar rastreio');
        }
    };

    public addPackage = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const newPackage = await this.packageService.addPackage(parsed.data, req.user!);
            res.status(201).json(newPackage);
        } catch (error) {
            this.handleError(res, error, 'Erro ao cadastrar pacote');
        }
    };

    public updateStatus = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageStatusSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Status inválido', errors: parsed.error.issues });
            return;
        }
        try {
            const updatedPackage = await this.packageService.updateStatus(req.params.id as string, parsed.data.status, req.user!);
            if (!updatedPackage) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(200).json(updatedPackage);
        } catch (error) {
            this.handleError(res, error, 'Erro ao atualizar status');
        }
    };

    public assignCourier = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageCourierSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Entregador inválido', errors: parsed.error.issues });
            return;
        }
        try {
            const packageRecord = await this.packageService.assignCourier(req.params.id as string, parsed.data.courierId, req.user!);
            if (!packageRecord) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(200).json(packageRecord);
        } catch (error) {
            this.handleError(res, error, 'Erro ao atribuir entregador');
        }
    };

    public cancelPackage = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageCancelSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Motivo do cancelamento inválido', errors: parsed.error.issues });
            return;
        }
        try {
            const cancelled = await this.packageService.deletePackage(req.params.id as string, req.user!, parsed.data.reason);
            if (!cancelled) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(200).json({ message: 'Entrega cancelada', status: 'Cancelado' });
        } catch (error) {
            this.handleError(res, error, 'Erro ao cancelar entrega');
        }
    };

    public createOffer = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageCourierSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Entregador inválido', errors: parsed.error.issues });
            return;
        }
        try {
            const offer = await this.packageService.createOffer(req.params.id as string, parsed.data.courierId, req.user!);
            if (!offer) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(201).json(offer);
        } catch (error) {
            this.handleError(res, error, 'Erro ao criar oferta');
        }
    };

    public createNearbyOffers = async (req: Request, res: Response): Promise<void> => {
        const parsed = nearbyOfferSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            res.status(400).json({ message: 'Parâmetros de proximidade inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const offers = await this.packageService.createNearbyOffers(
                req.params.id as string,
                req.user!,
                parsed.data.radiusMeters,
                parsed.data.limit,
            );
            if (!offers) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(201).json(offers);
        } catch (error) {
            this.handleError(res, error, 'Erro ao ofertar entrega por proximidade');
        }
    };

    public getOffers = async (req: Request, res: Response): Promise<void> => {
        try {
            res.status(200).json(await this.packageService.getOffers(req.user!));
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar ofertas');
        }
    };

    public respondToOffer = async (req: Request, res: Response): Promise<void> => {
        const parsed = offerResponseSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Resposta inválida', errors: parsed.error.issues });
            return;
        }
        try {
            const offer = await this.packageService.respondToOffer(req.params.offerId as string, req.user!, parsed.data.accepted);
            if (!offer) {
                res.status(404).json({ message: 'Oferta pendente não encontrada' });
                return;
            }
            res.status(200).json(offer);
        } catch (error) {
            this.handleError(res, error, 'Erro ao responder oferta');
        }
    };

    public updateLocation = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageLocationSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Coordenadas inválidas', errors: parsed.error.issues });
            return;
        }
        try {
            const location = await this.packageService.updateLocation(req.params.id as string, parsed.data, req.user!);
            if (!location) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(201).json(location);
        } catch (error) {
            this.handleError(res, error, 'Erro ao registrar localização');
        }
    };

    public updateCourierLocation = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageLocationSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Coordenadas inválidas', errors: parsed.error.issues });
            return;
        }
        try {
            const location = await this.packageService.updateCourierLocation(parsed.data, req.user!);
            res.status(200).json(location);
        } catch (error) {
            this.handleError(res, error, 'Erro ao atualizar localização do entregador');
        }
    };

    public getLocation = async (req: Request, res: Response): Promise<void> => {
        try {
            const location = await this.packageService.getLocation(req.params.id as string, req.user!);
            if (location === null) {
                res.status(200).json({ location: null });
                return;
            }
            res.status(200).json({ location });
        } catch (error) {
            this.handleError(res, error, 'Erro ao consultar localização');
        }
    };

    public createIncident = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageIncidentSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Ocorrência inválida', errors: parsed.error.issues });
            return;
        }
        try {
            const incident = await this.packageService.createIncident(req.params.id as string, parsed.data, req.user!);
            if (!incident) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(201).json(incident);
        } catch (error) {
            this.handleError(res, error, 'Erro ao registrar ocorrência');
        }
    };

    public getIncidents = async (req: Request, res: Response): Promise<void> => {
        try {
            const incidents = await this.packageService.getIncidents(req.params.id as string, req.user!);
            if (!incidents) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(200).json(incidents);
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar ocorrências');
        }
    };

    public confirmDelivery = async (req: Request, res: Response): Promise<void> => {
        try {
            const packageRecord = await this.packageService.confirmDelivery(req.params.id as string, req.user!);
            if (!packageRecord) {
                res.status(404).json({ message: 'Entrega não encontrada' });
                return;
            }
            res.status(200).json(packageRecord);
        } catch (error) {
            this.handleError(res, error, 'Erro ao confirmar entrega');
        }
    };

    public getNotifications = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = typeof req.query.page === 'string' ? Number(req.query.page) : undefined;
            const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
            res.status(200).json(await this.packageService.getNotifications(req.user!.id, page, limit));
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar notificações');
        }
    };

    public markNotificationRead = async (req: Request, res: Response): Promise<void> => {
        try {
            const updated = await this.packageService.markNotificationRead(req.params.notificationId as string, req.user!.id);
            if (!updated) {
                res.status(404).json({ message: 'Notificação não encontrada ou já lida' });
                return;
            }
            res.status(200).json({ message: 'Notificação marcada como lida' });
        } catch (error) {
            this.handleError(res, error, 'Erro ao atualizar notificação');
        }
    };

    public updatePackage = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const packageId = req.params.id as string;
            const updatedPackage = await this.packageService.updatePackage(packageId, parsed.data);
            if(updatedPackage) {
                res.status(200).json(updatedPackage);
            } else {
                res.status(404).json({ message: 'Package not found'});
            }
        } catch (error) {
            this.handleError(res, error, 'Erro ao atualizar pacote');
        }
    };

    public deletePackage = async (req: Request, res: Response): Promise<void> => {
    try {
      const packageId = req.params.id as string;
    const deleted = await this.packageService.deletePackage(packageId, req.user!, 'Cancelada pela gestão');
      if (deleted) {
                res.status(200).json({ message: 'Entrega cancelada e preservada no histórico' });
      } else {
        res.status(404).json({ message: 'Package not found' });
      }
    } catch (error) {
            this.handleError(res, error, 'Erro ao excluir pacote');
    }
  };

    private handleError(res: Response, error: unknown, message: string): void {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            res.status(400).json({ message: 'Cliente, endereço ou entregador inválido' });
            return;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404).json({ message: 'Entrega não encontrada' });
            return;
        }
        res.status(500).json({ message });
    }
}