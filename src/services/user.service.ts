import { z } from "zod";
import prisma from '@/lib/prisma';
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/utils/password";
import { AppError, UserRole } from "@/types";
import { toPublicUser } from "@/utils/user.mapper";

export const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  roles: z.nativeEnum(UserRole).array().min(1).optional(),
  clienteId: z.string().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
});

export type User = {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
};
export type UserInput = z.infer<typeof userSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

function toUserResponse(user: Prisma.UserGetPayload<{ include: { roles: true } }>): User {
  const publicUser = toPublicUser(user);
  return {
    id: publicUser.id,
    name: user.name,
    email: publicUser.email,
    roles: publicUser.roles,
    createdAt: publicUser.createdAt,
    updatedAt: publicUser.updatedAt,
  };
}

export class UserService {
  public async getAllUsers(params: {
    page?: number;
    limit?: number;
    where?: Partial<User>;
    orderBy?: { [key: string]: 'asc' | 'desc' };
  }): Promise<any> {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit || 0;
    const where = params.where ?
    {
        OR: Object.entries(params.where).map(([key, value]) => ({
            [key]: { contains: value, mode: 'insensitive' },
        })),
    }
    : {};
    const orderBy = params.orderBy
      ? Object.entries(params.orderBy).map(([key, value]) => ({
          [key]: value === 'asc' ? 'asc' as const : 'desc' as const,
        }))
      : { createdAt: 'desc' as const };
    const users = await prisma.user.findMany({
        skip,
        take: limit || 10,
        where,
        orderBy,
        include: { roles: true },
    });

    return users.map(toUserResponse);
  }

  public async getUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
    return user ? toUserResponse(user) : null;
  }

    public async createUser(
        userData: UserInput
    ) {
        const roles = userData.roles ?? [UserRole.USER];
        if (roles.includes(UserRole.CUSTOMER) && !userData.clienteId) {
          throw new AppError('Conta de cliente exige um cliente vinculado', 400);
        }
        const { roles: _roles, clienteId, ...userFields } = userData;
        const newUser = await prisma.user.create({
        data: {
            ...userFields,
            password: await hashPassword(userFields.password),
            roles: {
              connectOrCreate: roles.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
            ...(clienteId ? { cliente: { connect: { id: clienteId } } } : {}),
        },
        include: { roles: true },
        });
        return toUserResponse(newUser);
  }

  public async updateUser(
        id: string,
        userData: UserUpdateInput
    ): Promise<User | null> {
    try {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(userData.name !== undefined ? { name: userData.name } : {}),
          ...(userData.email !== undefined ? { email: userData.email } : {}),
          ...(userData.password !== undefined ? { password: await hashPassword(userData.password) } : {}),
        },
        include: { roles: true },
      });
      return toUserResponse(updatedUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }

  public async deleteUser(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }
}  