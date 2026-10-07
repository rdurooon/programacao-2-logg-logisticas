import { z } from "zod";
import prisma from '@/lib/prisma';
import { Prisma } from "@prisma/client";
import { comparePasswords, hashPassword } from "@/utils/password";
import { toAuthUser } from "@/utils/user.mapper";
import { signToken } from "@/utils/jwt";
import { User } from "./user.service";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(6, "Old password must be at least 6 characters long"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export class AuthService {
  public async login(input: LoginInput): Promise<{ token: string; user: any }> {
    
    const user = await prisma.user.findUnique({
        include: { roles: true },
        where: { email: input.email },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const isPasswordValid = await comparePasswords(input.password, user.password);
    console.log("isPasswordValid:", isPasswordValid); // Log the result
    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const authUser = toAuthUser(user);
    const token = signToken(authUser);

    return { token, user: authUser };
  }

  public async me(userId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      include: { roles: true },
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }
}