import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

/**
 * Hash password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Generate JWT token
 */
export const generateToken = (userId: string): string => {
  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any,
  };
  return jwt.sign({ userId }, JWT_SECRET, options);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): { userId: string } => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};