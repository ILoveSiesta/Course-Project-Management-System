import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";
import { getPrisma } from "../prisma.js";

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: "STUDENT" | "SUPERVISOR";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tokenJti?: string;
      tokenExp?: number;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);

    const prisma = getPrisma();

    // Check if token was revoked
    const revoked = await prisma.revokedToken.findUnique({
      where: { jti: payload.jti },
    });

    if (revoked) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required" },
      });
    }

    // Load active user
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication required" },
      });
    }

    req.user = user as AuthenticatedUser;
    req.tokenJti = payload.jti;
    req.tokenExp = payload.exp;

    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  }
}

export function requireRole(requiredRole: "STUDENT" | "SUPERVISOR") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== requiredRole) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Forbidden" },
      });
    }
    next();
  };
}
