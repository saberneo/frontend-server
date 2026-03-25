import { Test, TestingModule } from '@nestjs/testing';
import { TenantsService } from './tenants.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getRepositoryToken(Tenant), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
  });

  it('findAll returns tenant list', async () => {
    mockRepo.find.mockResolvedValue([
      { id: 't-1', slug: 'acme', name: 'ACME Corp', status: 'active' },
      { id: 't-2', slug: 'globex', name: 'Globex Corp', status: 'active' },
    ]);
    const result = await service.findAll();
    expect(result).toHaveLength(2);
  });

  it('findOne returns tenant by id', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 't-1', name: 'ACME Corp', status: 'active' });
    const result = await service.findOne('t-1');
    expect(result?.name).toBe('ACME Corp');
  });

  it('findOne returns null when tenant does not exist', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    const result = await service.findOne('ghost-id');
    expect(result).toBeNull();
  });

  it('create persists new tenant', async () => {
    const dto = { name: 'Wayne Enterprises', slug: 'wayne', contactEmail: 'admin@wayne.com' };
    const entity = { id: 't-new', ...dto, status: 'onboarding' };
    mockRepo.create.mockReturnValue(entity);
    mockRepo.save.mockResolvedValue(entity);

    const result = await service.create(dto as any);
    expect(result.id).toBe('t-new');
    expect(mockRepo.save).toHaveBeenCalledWith(entity);
  });
});
