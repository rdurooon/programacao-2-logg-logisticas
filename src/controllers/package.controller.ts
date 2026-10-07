import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '@/types';
import { PackageService, packageSchema, packageUpdateSchema } from '@/services/package.services'

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
                ...(typeof q === 'string' ? { where: q } : {})
            });
            res.status(200).json(packages);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching packages', error });
        }
    };

    public getPackageById = async (req: Request, res: Response): Promise<void> => {
        try {
            const packageId = req.params.id as string;
            const foundPackage = await this.packageService.getPackageById(packageId);
            if (foundPackage) {
                res.status(200).json(foundPackage);
            } else {
                res.status(404).json({ message: 'Package not found'})
            }
        } catch (error) {
            res.status(500).json({ message: 'Error fetching package'});
        }
    };

    public addPackage = async (req: Request, res: Response): Promise<void> => {
        const parsed = packageSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const newPackage = await this.packageService.addPackage(parsed.data);
            res.status(201).json(newPackage);
        } catch (error) {
            this.handleError(res, error, 'Erro ao cadastrar pacote');
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
      const deleted = await this.packageService.deletePackage(packageId);
      if (deleted) {
        res.status(200).json({ message: 'Package deleted successfully' });
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
            res.status(404).json({ message: 'Cliente ou endereço não encontrado' });
            return;
        }
        res.status(500).json({ message, error });
    }
}