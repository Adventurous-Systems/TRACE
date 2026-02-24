import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db, users } from '@trace/db';
import {
  UnauthorizedError,
  ConflictError,
  type LoginInput,
  type RegisterInput,
  type JwtPayload,
  type UserRole,
} from '@trace/core';

export async function loginUser(input: LoginInput): Promise<JwtPayload> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  });

  // Constant-time comparison path — always check hash to prevent timing attacks
  const dummyHash = '$2b$10$invalidhashusedtopreventimingtimingattacks';
  const passwordToCheck = user?.passwordHash ?? dummyHash;
  const valid = await bcrypt.compare(input.password, passwordToCheck);

  if (!user || !valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  return buildPayload(user);
}

export async function registerUser(input: RegisterInput): Promise<JwtPayload> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, input.email.toLowerCase()),
  });

  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      role: input.role,
      organisationId: input.organisationId ?? null,
    })
    .returning();

  return buildPayload(user!);
}

function buildPayload(user: {
  id: string;
  email: string;
  role: string;
  organisationId: string | null;
}): JwtPayload {
  return {
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
    ...(user.organisationId !== null ? { organisationId: user.organisationId } : {}),
  };
}
