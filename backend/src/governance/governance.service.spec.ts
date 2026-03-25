import { Test, TestingModule } from '@nestjs/testing';
import { GovernanceService } from './governance.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GovernanceProposal } from './governance-proposal.entity';
import { MappingReview } from './mapping-review.entity';
import { SyncJob } from '../connectors/sync-job.entity';

const mockProposalRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockReviewRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockSyncJobRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

describe('GovernanceService', () => {
  let service: GovernanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovernanceService,
        { provide: getRepositoryToken(GovernanceProposal), useValue: mockProposalRepo },
        { provide: getRepositoryToken(MappingReview), useValue: mockReviewRepo },
        { provide: getRepositoryToken(SyncJob), useValue: mockSyncJobRepo },
      ],
    }).compile();

    service = module.get<GovernanceService>(GovernanceService);
    jest.clearAllMocks();
  });

  describe('findProposals', () => {
    it('returns array of proposals', async () => {
      const mockProposals = [
        { id: 'p-1', status: 'pending', proposedBy: 'system' },
        { id: 'p-2', status: 'approved', proposedBy: 'user-1' },
      ];
      mockProposalRepo.find.mockResolvedValue(mockProposals);

      const result = await service.findProposals();
      expect(result).toHaveLength(2);
      expect(mockProposalRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('approveProposal', () => {
    it('sets status to approved and saves', async () => {
      const proposal = { id: 'p-1', status: 'pending', proposedBy: 'system' };
      mockProposalRepo.findOne.mockResolvedValue(proposal);
      mockProposalRepo.save.mockResolvedValue({ ...proposal, status: 'approved' });

      const result = await service.approveProposal('p-1', 'admin@nexus.io');
      expect(result.status).toBe('approved');
      expect(mockProposalRepo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when proposal not found', async () => {
      mockProposalRepo.findOne.mockResolvedValue(null);
      await expect(service.approveProposal('not-exist', 'admin')).rejects.toThrow();
    });
  });

  describe('rejectProposal', () => {
    it('sets status to rejected with reason', async () => {
      const proposal = { id: 'p-1', status: 'pending' };
      mockProposalRepo.findOne.mockResolvedValue(proposal);
      mockProposalRepo.save.mockResolvedValue({ ...proposal, status: 'rejected' });

      const result = await service.rejectProposal('p-1', 'admin@nexus.io', 'Duplicate field');
      expect(result.status).toBe('rejected');
    });
  });

  describe('findMappingReviews', () => {
    it('returns mapping reviews', async () => {
      mockReviewRepo.find.mockResolvedValue([{ id: 'mr-1', status: 'pending' }]);
      const result = await service.findMappingReviews();
      expect(result).toHaveLength(1);
    });
  });
});
