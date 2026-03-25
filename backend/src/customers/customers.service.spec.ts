import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';

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
};

const mockOrdersService = {
  findAll: jest.fn(),
};

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: mockRepo },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe('findAll', () => {
    it('returns paginated customers', async () => {
      const customers = [
        { id: 'c-1', name: 'ACME Corp', revenueYtd: 50000 },
        { id: 'c-2', name: 'Globex Inc', revenueYtd: 30000 },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([customers, 10]);

      const result = await service.findAll({} as any);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('applies search filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ search: 'acme' } as any);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('applies status filter', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ status: 'active' } as any);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'c.status = :status', { status: 'active' }
      );
    });
  });

  describe('findOne', () => {
    it('returns customer by id', async () => {
      const customer = { id: 'c-1', name: 'ACME Corp', status: 'active' };
      mockRepo.findOne.mockResolvedValue(customer);

      const result = await service.findOne('c-1');
      expect(result).toEqual(customer);
    });

    it('throws NotFoundException when customer not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
