import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('creates and saves an audit log entry', async () => {
      const data = { action: 'UPDATE', entity: 'User', entityId: 'u-1', userId: 'admin' };
      const entry = { id: 'al-1', ...data, timestamp: new Date() };
      mockRepo.create.mockReturnValue(entry);
      mockRepo.save.mockResolvedValue(entry);

      const result = await service.log(data as any);
      expect(result.id).toBe('al-1');
      expect(mockRepo.create).toHaveBeenCalledWith(data);
      expect(mockRepo.save).toHaveBeenCalledWith(entry);
    });
  });

  describe('findPaginated', () => {
    it('returns paginated audit logs with metadata', async () => {
      const logs = [
        { id: 'al-1', action: 'CREATE', entity: 'Order' },
        { id: 'al-2', action: 'UPDATE', entity: 'Customer' },
      ];
      mockRepo.findAndCount.mockResolvedValue([logs, 42]);

      const result = await service.findPaginated(10, 3);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(42);
      expect(result.page).toBe(3);
      expect(result.totalPages).toBe(5); // ceil(42/10)
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it('uses default limit=50 and page=1', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.findPaginated();
      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });
  });

  describe('findByEntity', () => {
    it('returns logs for a given entity type', async () => {
      const logs = [
        { id: 'al-1', entity: 'Order', entityId: 'so-001' },
        { id: 'al-2', entity: 'Order', entityId: 'so-002' },
      ];
      mockRepo.find.mockResolvedValue(logs);

      const result = await service.findByEntity('Order');
      expect(result).toHaveLength(2);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entity: 'Order' } }),
      );
    });

    it('filters by entityId when provided', async () => {
      mockRepo.find.mockResolvedValue([{ id: 'al-1', entity: 'Order', entityId: 'so-001' }]);

      await service.findByEntity('Order', 'so-001');
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entity: 'Order', entityId: 'so-001' } }),
      );
    });
  });
});
