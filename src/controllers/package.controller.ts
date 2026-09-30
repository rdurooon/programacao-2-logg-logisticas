import { Request, Response } from 'express';
import { Package, PackageService } from '@/services/package.services'

export class PackageController {
    private packageService: PackageService;

    constructor() {
        this.packageService = new PackageService();
    }

    public getAllPackages = async (req: Request, res: Response): Promise<void> => {
        try {
            const { page, limit, q } = req.query as any;
            const packages = await this.packageService.getAllPackages({
                page: Number(page),
                limit: Number(limit),
                where: q
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
        try {
            const packageData = req.body;
            const newPackage = await this.packageService.addPackage(packageData);
            res.status(201).json(newPackage);
        } catch (error) {
            res.status(500).json({ message: 'Error adding package'});
        }
    };

    public updatePackage = async (req: Request, res: Response): Promise<void> => {
        try {
            const packageId = req.params.id as string;
            const packageData = req.body;
            const updatedPackage = await this.packageService.updatePackage(packageId, packageData);
            if(updatedPackage) {
                res.status(200).json(updatedPackage);
            } else {
                res.status(404).json({ message: 'Package not found'});
            }
        } catch (error) {
            res.status(500).json({ message: 'Error updating package', error });
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
      res.status(500).json({ message: 'Error deleting package', error });
    }
  };
}