import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { UserService, userSchema, userUpdateSchema } from '@/services/user.service';
import { AppError } from '@/types';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, q, orderBy } = req.query as any;
      const users = await this.userService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        where: q,
        orderBy,
      });
      res.status(200).json(users);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching users', error });
    }
  };

  public getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const user = await this.userService.getUserById(userId);
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error fetching user', error });
    }
  };

  public createUser = async (req: Request, res: Response): Promise<void> => {
    const parsed = userSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
      return;
    }
    try {
      const newUser = await this.userService.createUser(parsed.data);
      res.status(201).json(newUser);
    } catch (error) {
      this.handleError(res, error, 'Erro ao cadastrar usuário');
    }
  };

  public updateUser = async (req: Request, res: Response): Promise<void> => {
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.issues });
      return;
    }
    try {
      const userId = req.params.id as string;
      const updatedUser = await this.userService.updateUser(userId, parsed.data);
      if (updatedUser) {
        res.status(200).json(updatedUser);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      this.handleError(res, error, 'Erro ao atualizar usuário');
    }
  };

  public deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.params.id as string;
      const deleted = await this.userService.deleteUser(userId);
      if (deleted) {
        res.status(200).json({ message: 'User deleted successfully' });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Error deleting user', error });
    }
  };

  private handleError(res: Response, error: unknown, message: string): void {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'E-mail ou vínculo já está em uso' });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ message: 'Usuário ou cliente não encontrado' });
      return;
    }
    res.status(500).json({ message });
  }
}   