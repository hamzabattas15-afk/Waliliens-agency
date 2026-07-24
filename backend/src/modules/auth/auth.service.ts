import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../lib/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { AppError } from '../../middleware/errorHandler.js';
import { LoginInput } from './auth.schema.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

export async function loginUser(input: LoginInput): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  // Use same error for wrong email AND wrong password to prevent user enumeration
  const INVALID_CREDENTIALS = new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');

  if (!user) {
    // Run a dummy verify to maintain constant time
    await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$dummy', 'password').catch(() => {});
    throw INVALID_CREDENTIALS;
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw INVALID_CREDENTIALS;
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = signRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string }> {
  const payload = verifyRefreshToken(refreshToken);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return { accessToken };
}
