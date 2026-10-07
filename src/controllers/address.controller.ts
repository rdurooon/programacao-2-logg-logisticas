import { Request, Response } from 'express';
import { AddressService, addressSchema, addressUpdateSchema } from '@/services/address.service';
import { AppError } from '@/types';

export class AddressController {
    private addressService: AddressService;

    constructor() {
        this.addressService = new AddressService();
    }

    public getAllAddresses = async (req: Request, res: Response): Promise<void> => {
        try {
            const { page, limit, clienteId, q } = req.query;
            const addresses = await this.addressService.getAllAddresses({
                ...(typeof page === 'string' ? { page: Number(page) } : {}),
                ...(typeof limit === 'string' ? { limit: Number(limit) } : {}),
                ...(typeof clienteId === 'string' ? { clienteId } : {}),
                ...(typeof q === 'string' ? { q } : {}),
            });
            res.status(200).json(addresses);
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar endereços');
        }
    };

    public getAddressById = async (req: Request, res: Response): Promise<void> => {
        try {
            const address = await this.addressService.getAddressById(req.params.id as string);
            if (!address) {
                res.status(404).json({ message: 'Endereço não encontrado' });
                return;
            }
            res.status(200).json(address);
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar endereço');
        }
    };

    public createAddress = async (req: Request, res: Response): Promise<void> => {
        const parsed = addressSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const address = await this.addressService.createAddress(parsed.data);
            res.status(201).json(address);
        } catch (error) {
            this.handleError(res, error, 'Erro ao cadastrar endereço');
        }
    };

    public updateAddress = async (req: Request, res: Response): Promise<void> => {
        const parsed = addressUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const address = await this.addressService.updateAddress(req.params.id as string, parsed.data);
            if (!address) {
                res.status(404).json({ message: 'Endereço não encontrado' });
                return;
            }
            res.status(200).json(address);
        } catch (error) {
            this.handleError(res, error, 'Erro ao atualizar endereço');
        }
    };

    public deleteAddress = async (req: Request, res: Response): Promise<void> => {
        try {
            const deleted = await this.addressService.deleteAddress(req.params.id as string);
            if (!deleted) {
                res.status(404).json({ message: 'Endereço não encontrado' });
                return;
            }
            res.status(200).json({ message: 'Endereço excluído com sucesso' });
        } catch (error) {
            this.handleError(res, error, 'Erro ao excluir endereço');
        }
    };

    private handleError(res: Response, error: unknown, message: string): void {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        res.status(500).json({ message, error });
    }
}