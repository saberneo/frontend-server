import { Test, TestingModule } from '@nestjs/testing';
import { ConnectorsService } from './connectors.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Connector } from './connector.entity';
import { SyncJob } from './sync-job.entity';

const mockConnectorRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const mockSyncJobRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

describe('ConnectorsService', () => {
  let service: ConnectorsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConnectorsService,
        { provide: getRepositoryToken(Connector), useValue: mockConnectorRepo },
        { provide: getRepositoryToken(SyncJob), useValue: mockSyncJobRepo },
      ],
    }).compile();

    service = module.get<ConnectorsService>(ConnectorsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns all connectors', async () => {
      const connectors = [
        { id: 'c-1', name: 'Salesforce Prod', systemType: 'SALESFORCE', status: 'active' },
        { id: 'c-2', name: 'MySQL Orders', systemType: 'MYSQL', status: 'active' },
      ];
      mockConnectorRepo.find.mockResolvedValue(connectors);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(mockConnectorRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('returns connector by id', async () => {
      const connector = { id: 'c-1', name: 'Salesforce Prod', systemType: 'SALESFORCE' };
      mockConnectorRepo.findOne.mockResolvedValue(connector);

      const result = await service.findOne('c-1');
      expect(result).toEqual(connector);
    });

    it('throws when connector not found', async () => {
      mockConnectorRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('creates and saves a new connector', async () => {
      const dto = { name: 'Odoo ERP', type: 'ODOO', systemType: 'ODOO', tenantId: 'acme' };
      const created = { id: 'c-new', ...dto, status: 'pending' };
      mockConnectorRepo.create.mockReturnValue(created);
      mockConnectorRepo.save.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result.id).toBe('c-new');
      expect(mockConnectorRepo.save).toHaveBeenCalled();
    });
  });

  describe('findSyncJobs', () => {
    it('returns sync jobs for a connector', async () => {
      const jobs = [
        { id: 'j-1', connectorId: 'c-1', status: 'completed', startedAt: new Date() },
        { id: 'j-2', connectorId: 'c-1', status: 'running', startedAt: new Date() },
      ];
      mockSyncJobRepo.find.mockResolvedValue(jobs);

      const result = await service.findSyncJobs('c-1');
      expect(result).toHaveLength(2);
    });
  });
});
