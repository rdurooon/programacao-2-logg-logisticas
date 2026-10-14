import jwt from 'jsonwebtoken';

import { AuthUser, UserRole } from '../types/index';

export type JwtPayload = {
    sub: string;
    email: string;
    roles: UserRole[];
};

function getSecretKey(): string {
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey || Buffer.byteLength(secretKey, 'utf8') < 32) {
        throw new Error('JWT_SECRET deve conter pelo menos 32 bytes');
    }
    return secretKey;
}

export function signToken(
    user: Pick<AuthUser, 'id' | 'email' | 'roles'>
): string {
    const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        roles: user.roles,
    };

    const options = {
        expiresIn: Number(process.env.JWT_EXPIRES_IN) || 3600,
    };

    return jwt.sign(payload, getSecretKey(), options);
}

export function verifyToken(token: string): JwtPayload {
    const decoded = jwt.verify(token, getSecretKey()) as JwtPayload;
    if (
        typeof decoded === 'string' 
        || !decoded 
        || typeof decoded !== 'object'
    ) {
        throw new Error('Invalid token');
    }

    const payload = decoded as unknown as JwtPayload & { role?: string };
    if (!payload.sub || !payload.email) {
        throw new Error('Invalid token payload');
    }

    const roles: UserRole[] = Array.isArray(payload.roles)
        ? payload.roles
        : payload.role && 
            Object.values(UserRole).includes(payload.role as UserRole)
            ? [payload.role as UserRole]
            : []

    return {
        sub: payload.sub,
        email: payload.email,
        roles
    };
}
