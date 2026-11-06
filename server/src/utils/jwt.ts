import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import "./env.js";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

export interface TokenPayload {
  sub: number;
  role: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export function signToken(
  user: { id: number; role: string },
  options?: { expiresIn?: string }
): string {
  const jti = randomUUID();
  const expiresIn = options?.expiresIn || process.env.JWT_EXPIRES_IN || "2h";

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      jti,
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: expiresIn as any,
    }
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  }) as unknown as TokenPayload;
}
