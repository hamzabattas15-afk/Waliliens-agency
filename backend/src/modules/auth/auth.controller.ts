import { Request, Response, NextFunction } from 'express';
import { loginSchema } from './auth.schema.js';
import { loginUser, refreshAccessToken, revokeRefreshTokens } from './auth.service.js';
import { verifyRefreshToken } from '../../lib/jwt.js';
import { AppError } from '../../middleware/errorHandler.js';
import { env } from '../../config/env.js';

const REFRESH_COOKIE_NAME = 'waliliens_refresh_token';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/api/auth',
};

/**
 * POST /api/auth/login
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError('Invalid credentials', 401, 'VALIDATION_ERROR');
    }

    const { accessToken, refreshToken, user } = await loginUser(parseResult.data);

    // Set refresh token as httpOnly cookie
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!refreshToken) {
      throw new AppError('No refresh token', 401, 'NO_REFRESH_TOKEN');
    }

    const { accessToken } = await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 *
 * Revokes every outstanding refresh token for this user (by bumping their
 * tokenVersion), not just the one presented — so logout works even if the
 * user has other sessions/devices with a refresh cookie they want revoked.
 * A missing, invalid, or expired cookie is not an error: there's simply
 * nothing to revoke, and logout must always succeed for the client.
 */
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken, { ignoreExpiration: true });
        await revokeRefreshTokens(payload.sub);
      } catch {
        // Invalid/forged/foreign-signature cookie — nothing to revoke.
      }
    }

    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
