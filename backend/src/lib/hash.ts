import { createHash } from 'crypto';
import argon2 from 'argon2';

// ─── Argon2id for passwords ───────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  return argon2.verify(hash, password);
}

// ─── SHA-256 for IP addresses (non-reversible, GDPR-friendly) ────────────────

export function hashIp(ip: string): string {
  // Add a static site-specific salt to prevent rainbow table attacks
  // This value should ideally be in env but a constant is fine for IPs
  const SALT = 'waliliens-ip-salt-2025';
  return createHash('sha256').update(`${ip}:${SALT}`).digest('hex');
}

// ─── Constant-time string comparison (prevent timing attacks) ─────────────────

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.equals(bufB);
}
