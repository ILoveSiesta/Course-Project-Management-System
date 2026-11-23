import bcrypt from "bcryptjs";
import { getPrisma } from "../prisma.js";
import { signToken } from "../utils/jwt.js";
import { hasInvalidTextCharacters } from "../utils/validation.js";

// Precomputed valid cost-10 bcrypt hash so unknown-email login performs equivalent bcrypt work (#92).
const DUMMY_PASSWORD_HASH = "$2b$10$5LX0/AcvJCLksUFWipWu4.pEqD/yomwk8htzGf/3j8/PD1ntLjDgK";

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
  } else if (hasInvalidTextCharacters(email)) {
    details.email = "INVALID_CHARACTER";
  }
  if (!password || typeof password !== "string") {
    details.password = "REQUIRED";
  } else if (hasInvalidTextCharacters(password)) {
    details.password = "INVALID_CHARACTER";
  }

  if (Object.keys(details).length > 0) {
    const hasInvalidChar = Object.values(details).includes("INVALID_CHARACTER");
    throw new AuthError(
      400,
      "VALIDATION_ERROR",
      hasInvalidChar ? "Email or password contains an unsupported character" : "Email and password are required",
      details
    );
  }

  const normalizedEmail = email!.trim().toLowerCase();
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  const isPasswordValid = await bcrypt.compare(password!, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !isPasswordValid) {
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

  // Idempotent insert avoids concurrent upsert P2002 races when one token logs out in parallel (#92).
  await prisma.revokedToken.createMany({
    data: [{ jti, expiresAt }],
    skipDuplicates: true,
  });
}
