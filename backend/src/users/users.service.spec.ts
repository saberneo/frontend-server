import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns list of users ordered by createdAt DESC', async () => {
      const users = [
        { id: 'u-1', email: 'alice@nexus.io', role: 'admin' },
        { id: 'u-2', email: 'bob@nexus.io', role: 'viewer' },
      ];
      mockRepo.find.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        where: [{ source: 'okta' }, { status: 'invited' }],
      });
    });
  });

  describe('findOne', () => {
    it('returns user by id', async () => {
      const user = { id: 'u-1', email: 'alice@nexus.io' };
      mockRepo.findOne.mockResolvedValue(user);

      const result = await service.findOne('u-1');
      expect(result).toEqual(user);
    });

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('returns null when no user has that email', async () => {
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(null) };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findByEmail('nobody@x.io');
      expect(result).toBeNull();
    });

    it('returns user with passwordHash when found', async () => {
      const user = { id: 'u-1', email: 'alice@nexus.io', passwordHash: 'hashed' };
      const qb = { addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn().mockResolvedValue(user) };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findByEmail('alice@nexus.io');
      expect(result?.passwordHash).toBe('hashed');
    });
  });

  describe('create', () => {
    it('creates user with bcrypt-hashed password', async () => {
      mockRepo.findOne.mockResolvedValue(null); // no conflict
      const dto = { email: 'newuser@nexus.io', password: 'Secret123!', role: 'viewer' as const };
      const entity = { id: 'u-new', email: dto.email, role: 'viewer', status: 'invited' };
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(dto as any);
      expect(result.id).toBe('u-new');
      expect(mockRepo.save).toHaveBeenCalled();
      // Verify create was called with a hashed password (not plaintext)
      const createCall = mockRepo.create.mock.calls[0][0];
      expect(createCall.passwordHash).toBeDefined();
      expect(createCall.passwordHash).not.toBe('Secret123!');
      const isValidHash = await bcrypt.compare('Secret123!', createCall.passwordHash);
      expect(isValidHash).toBe(true);
    });

    it('throws ConflictException when email already registered', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'u-existing', email: 'taken@nexus.io' });
      await expect(
        service.create({ email: 'taken@nexus.io', password: 'pass', role: 'viewer' } as any)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates user fields and saves', async () => {
      const user = { id: 'u-1', email: 'alice@nexus.io', role: 'viewer' };
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.save.mockResolvedValue({ ...user, role: 'admin' });

      const result = await service.update('u-1', { role: 'admin' } as any);
      expect(result.role).toBe('admin');
    });
  });

  describe('remove', () => {
    it('removes user by id', async () => {
      const user = { id: 'u-1', email: 'alice@nexus.io' };
      mockRepo.findOne.mockResolvedValue(user);
      mockRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove('u-1')).resolves.toBeUndefined();
      expect(mockRepo.remove).toHaveBeenCalledWith(user);
    });

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
