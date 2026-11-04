import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-local-only";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";

export interface TokenPayload {
  sub: number;
  role: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export function signToken(user: { id: number; role: string }): string {
  const jti = randomUUID();
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      jti,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN as any,
    }
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
}
