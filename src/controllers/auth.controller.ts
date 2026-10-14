import { AuthService, loginSchema } from "@/services/auth.service";
import { Request, Response } from "express";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  public login = async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Dados de autenticação inválidos' });
      return;
    }
    try {
      const { token, user } = await this.authService.login(parsed.data);
      res.json({ token, user });
    } catch {
      res.status(401).json({ message: 'E-mail ou senha inválidos' });
    }
  };

  public me = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.authService.me(req.user!.id);
      res.json(user);
    } catch (error) {
      res.status(404).json({ message: 'Usuário não encontrado' });
    }
  }
}