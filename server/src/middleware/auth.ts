import { Request, Response, NextFunction } from "express";
import { TokenPayload, verifyToken } from "../utils/jwt.js";
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

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  }

  if (
    typeof payload?.sub !== "number" ||
    !Number.isInteger(payload.sub) ||
    typeof payload?.jti !== "string" ||
    !payload.jti
  ) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  }

  let revoked: { jti: string } | null;
  let user: AuthenticatedUser | null;
  try {
    const prisma = getPrisma();

    // Forward DB/connection failures via next(err) so outages return logged 500 rather than false 401s (#92).
    revoked = await prisma.revokedToken.findUnique({
      where: { jti: payload.jti },
    });

    if (!revoked) {
      user = (await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, role: true },
      })) as AuthenticatedUser | null;
    } else {
      user = null;
    }
  } catch (err) {
    return next(err);
  }

  if (revoked || !user) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Authentication required" },
    });
  }

  req.user = user;
  req.tokenJti = payload.jti;
  req.tokenExp = payload.exp;

  return next();
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
