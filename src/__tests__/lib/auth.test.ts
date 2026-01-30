/**
 * Tests para módulo de autenticación
 * @module __tests__/lib/auth
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock de jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  default: {
    sign: jest.fn(() => 'mocked-token'),
    verify: jest.fn((token: string) => {
      if (token === 'valid-token') {
        return { userId: 1, usuario: 'admin', rol: 'admin' };
      }
      throw new Error('Invalid token');
    }),
  },
}));

// Mock de la base de datos
jest.mock('@/lib/db', () => ({
  getPool: jest.fn(() => ({
    request: () => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [{ Id: 1, Usuario: 'admin', Rol: 'admin', Activo: true }],
      }),
    }),
  })),
}));

describe('Auth Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-min-32-characters!!';
  });

  describe('Token Generation', () => {
    it('should generate a valid JWT token', async () => {
      const { generateToken } = await import('@/lib/auth');

      const user = { id: 1, usuario: 'admin', rol: 'admin' };
      const token = await generateToken(user);

      expect(token).toBe('mocked-token');
    });
  });

  describe('Token Verification', () => {
    it('should verify a valid token', async () => {
      const { verifyToken } = await import('@/lib/auth');

      const payload = await verifyToken('valid-token');

      expect(payload).toEqual({
        userId: 1,
        usuario: 'admin',
        rol: 'admin',
      });
    });

    it('should return null for invalid token', async () => {
      const { verifyToken } = await import('@/lib/auth');

      const payload = await verifyToken('invalid-token');

      expect(payload).toBeNull();
    });
  });

  describe('Token Extraction', () => {
    it('should extract token from cookie header', async () => {
      const { getTokenFromRequest } = await import('@/lib/auth');

      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          cookie: 'auth_token=test-token; other=value',
        },
      });

      const token = getTokenFromRequest(request);

      expect(token).toBe('test-token');
    });

    it('should return null if no auth cookie', async () => {
      const { getTokenFromRequest } = await import('@/lib/auth');

      const request = new Request('http://localhost:3000/api/test', {
        headers: {
          cookie: 'other=value',
        },
      });

      const token = getTokenFromRequest(request);

      expect(token).toBeNull();
    });
  });
});
