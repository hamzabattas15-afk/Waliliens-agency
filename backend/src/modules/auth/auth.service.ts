import { prisma } from '../../db/prisma.js';
import { verifyPassword } from '../../lib/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { AppError } from '../../middleware/errorHandler.js';
import { LoginInput } from './auth.schema.js';

// A genuinely valid argon2id hash (same cost params as hashPassword), used
// only to make the "user not found" path cost the same as a real password
// check — argon2.verify() throws immediately on a malformed hash, doing
// none of the actual work, so a fake-looking string here would defeat the
// whole point of this dummy verify. Generated once with:
//   argon2.hash('this-is-a-fixed-dummy-password-used-only-for-timing-equalisation',
//     { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$cQ+gHjj9dpFu8Hwhcqr8LA$p/GnbwOKwOLt/tNAdkLa4y4SNKtNSsUHz4UaAjMeU00';

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
    // Run a dummy verify against a real hash to maintain constant time.
    await verifyPassword(DUMMY_PASSWORD_HASH, input.password).catch(() => {});
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

  const refreshToken = signRefreshToken(user.id, user.tokenVersion);

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
    select: { id: true, email: true, role: true, tokenVersion: true },
  });

  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('Refresh token has been revoked', 401, 'TOKEN_REVOKED');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return { accessToken };
}

/**
 * Bump the user's tokenVersion so every refresh token issued before this
 * point (embedding the old version) fails verification in refreshAccessToken.
 */
export async function revokeRefreshTokens(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });
}
