import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '@/types';
import { ClienteService, clienteSchema, clienteUpdateSchema } from '@/services/cliente.service';

export class ClienteController {
    private clienteService: ClienteService;

    constructor() {
        this.clienteService = new ClienteService();
    }

    public getAllClientes = async (req: Request, res: Response): Promise<void> => {
        try {
            const { page, limit, q } = req.query;
            const clientes = await this.clienteService.getAllClientes({
                ...(typeof page === 'string' ? { page: Number(page) } : {}),
                ...(typeof limit === 'string' ? { limit: Number(limit) } : {}),
                ...(typeof q === 'string' ? { q } : {}),
            });
            res.status(200).json(clientes);
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar clientes');
        }
    };

    public getClienteById = async (req: Request, res: Response): Promise<void> => {
        try {
            const cliente = await this.clienteService.getClienteById(req.params.id as string);
            if (!cliente) {
                res.status(404).json({ message: 'Cliente não encontrado' });
                return;
            }
            res.status(200).json(cliente);
        } catch (error) {
            this.handleError(res, error, 'Erro ao buscar cliente');
        }
    };

    public createCliente = async (req: Request, res: Response): Promise<void> => {
        const parsed = clienteSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const cliente = await this.clienteService.createCliente(parsed.data);
            res.status(201).json(cliente);
        } catch (error) {
            this.handleError(res, error, 'Erro ao cadastrar cliente');
        }
    };

    public updateCliente = async (req: Request, res: Response): Promise<void> => {
        const parsed = clienteUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
            return;
        }
        try {
            const cliente = await this.clienteService.updateCliente(req.params.id as string, parsed.data);
            if (!cliente) {
                res.status(404).json({ message: 'Cliente não encontrado' });
                return;
            }
            res.status(200).json(cliente);
        } catch (error) {
            this.handleError(res, error, 'Erro ao atualizar cliente');
        }
    };

    public deleteCliente = async (req: Request, res: Response): Promise<void> => {
        try {
            const cliente = await this.clienteService.deleteCliente(req.params.id as string);
            if (!cliente) {
                res.status(404).json({ message: 'Cliente não encontrado' });
                return;
            }
            res.status(200).json({ message: 'Cliente excluído com sucesso' });
        } catch (error) {
            this.handleError(res, error, 'Erro ao excluir cliente');
        }
    };

    private handleError(res: Response, error: unknown, message: string): void {
        if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
            return;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            res.status(409).json({ message: 'Não é possível excluir um cliente que possui pacotes' });
            return;
        }
        res.status(500).json({ message, error });
    }
}