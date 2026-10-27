import jwt from 'jsonwebtoken';

/**
 * Generate extension API token
 * Tokens are scoped to an organization and expire in 1 year
 */
export function generateExtensionToken(orgId: string): string {
  const secret = process.env.EXTENSION_JWT_SECRET!;
  
  return jwt.sign(
    { orgId, type: 'extension' },
    secret,
    { expiresIn: '365d' }
  );
}

/**
 * Verify extension API token
 */
export function verifyExtensionToken(token: string): { orgId: string } | null {
  try {
    const secret = process.env.EXTENSION_JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as { orgId: string; type: string };
    
    if (decoded.type !== 'extension') {
      return null;
    }
    
    return { orgId: decoded.orgId };
  } catch (err) {
    return null;
  }
}
