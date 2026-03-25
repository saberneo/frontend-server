import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { TokenBlacklistService } from './token-blacklist.service';
import * as bcrypt from 'bcryptjs';

const mockUserRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '1h',
    };
    return map[key];
  }),
};

const mockBlacklist = {
  revoke: jest.fn(),
  isRevoked: jest.fn().mockReturnValue(false),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: TokenBlacklistService, useValue: mockBlacklist },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('returns user payload when credentials are valid', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: 'u-1',
        email: 'admin@nexus.io',
        passwordHash: hashed,
        role: 'admin',
        lastLogin: null,
        totpEnabled: false,
      };
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(mockUser) };
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.save.mockResolvedValue({ ...mockUser, lastLogin: new Date() });

      const result = await authService.validateUser('admin@nexus.io', 'password123');
      expect(result).toBeDefined();
      expect(result?.email).toBe('admin@nexus.io');
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const hashed = await bcrypt.hash('correct-pass', 10);
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue({ id: 'u-1', email: 'admin@nexus.io', passwordHash: hashed }) };
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(authService.validateUser('admin@nexus.io', 'wrong-pass')).rejects.toThrow();
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);
      await expect(authService.validateUser('ghost@nexus.io', 'pass')).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('returns access_token JWT for valid credentials', async () => {
      const hashed = await bcrypt.hash('Admin1234!', 10);
      const mockUser = {
        id: 'u-1',
        email: 'admin@nexus.io',
        passwordHash: hashed,
        role: 'admin',
        totpEnabled: false,
        lastLogin: null,
      };
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(mockUser) };
      mockUserRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.save.mockResolvedValue({ ...mockUser, lastLogin: new Date() });

      const result = await authService.login('admin@nexus.io', 'Admin1234!');

      expect(result).toHaveProperty('access_token');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });
  });
});

