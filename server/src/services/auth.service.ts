import bcrypt from "bcryptjs";
import { getPrisma } from "../prisma.js";
import { signToken } from "../utils/jwt.js";

export class AuthError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function loginService(email?: string, password?: string) {
  const details: Record<string, string> = {};
  if (!email || typeof email !== "string" || !email.trim()) {
    details.email = "REQUIRED";
  }
  if (!password || typeof password !== "string") {
    details.password = "REQUIRED";
  }

  if (Object.keys(details).length > 0) {
    throw new AuthError(400, "VALIDATION_ERROR", "Email and password are required", details);
  }

  const normalizedEmail = email!.trim().toLowerCase();
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const isPasswordValid = await bcrypt.compare(password!, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const token = signToken({ id: user.id, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function logoutService(jti: string, exp?: number) {
  const prisma = getPrisma();
  const expiresAt = exp ? new Date(exp * 1000) : new Date(Date.now() + 2 * 60 * 60 * 1000);

  await prisma.revokedToken.upsert({
    where: { jti },
    update: {},
    create: {
      jti,
      expiresAt,
    },
  });
}
