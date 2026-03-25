import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { NotFoundException } from '@nestjs/common';

const mockQueryBuilder = {
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(),
};

const mockRepo = {
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
};

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('findAll', () => {
    it('returns paginated orders', async () => {
      const orders = [
        { id: 'so-001', status: 'Processing', amount: 199.99 },
        { id: 'so-002', status: 'Delivered', amount: 49.99 },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([orders, 25]);

      const result = await service.findAll({ limit: 10, page: 1 } as any);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(3);
    });

    it('applies status filter when provided', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ status: 'Processing' } as any);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(o.status) = LOWER(:status)', { status: 'Processing' }
      );
    });
  });

  describe('findOne', () => {
    it('returns order by id', async () => {
      const order = { id: 'so-001', status: 'Processing' };
      mockRepo.findOne.mockResolvedValue(order);

      const result = await service.findOne('so-001');
      expect(result).toEqual(order);
    });

    it('throws NotFoundException when order not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates order status', async () => {
      const order = { id: 'so-001', status: 'Processing', trackingNumber: null };
      mockRepo.findOne.mockResolvedValue(order);
      mockRepo.save.mockResolvedValue({ ...order, status: 'Shipped', trackingNumber: 'TRK-123' });

      const result = await service.updateStatus('so-001', { status: 'Shipped', trackingNumber: 'TRK-123' } as any);
      expect(result.status).toBe('Shipped');
      expect(result.trackingNumber).toBe('TRK-123');
    });
  });

  describe('getStats', () => {
    it('returns counts for each status', async () => {
      mockRepo.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // processing
        .mockResolvedValueOnce(30)  // shipped
        .mockResolvedValueOnce(45)  // delivered
        .mockResolvedValueOnce(5);  // cancelled

      const result = await service.getStats();
      expect(result).toEqual({ total: 100, processing: 20, shipped: 30, delivered: 45, cancelled: 5 });
    });
  });

  describe('create', () => {
    it('generates SO- prefixed id and saves order', async () => {
      const dto = { customer: 'ACME Corp', amount: 350.00, status: 'Processing', tenantId: 't-1' };
      const entity = { id: 'SO-ABC123', ...dto };
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.create(dto as any);
      expect(result.id).toMatch(/^SO-/);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });
});
