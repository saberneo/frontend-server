import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';

const mockDataSource = {
  query: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: any) => {
    const map: Record<string, string> = { OPENAI_API_KEY: 'sk-test-key' };
    return map[key] ?? fallback;
  }),
};

// Mock the https module used by AiService.callOpenAI
jest.mock('https', () => ({
  request: jest.fn((options: any, callback: any) => {
    const res = {
      on: jest.fn((event: string, handler: any) => {
        if (event === 'data') handler(JSON.stringify({
          choices: [{ message: { content: 'NEXUS AI mock response' } }],
        }));
        if (event === 'end') handler();
      }),
    };
    callback(res);
    return {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  }),
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('returns a string response when DB context is available', async () => {
      // Mock all 5 parallel queries in buildContext
      mockDataSource.query
        .mockResolvedValueOnce([{ total: '150', delivered: '80', processing: '40', pending: '20', cancelled: '10', total_revenue: '45000.00' }])
        .mockResolvedValueOnce([{ name: 'ACME', revenue: '12000', orders: '30' }])
        .mockResolvedValueOnce([{ total: '200', active: '180' }])
        .mockResolvedValueOnce([{ total: '50', low_stock: '5' }])
        .mockResolvedValueOnce([{ total: '6', active: '5' }]);

      const result = await service.chat('How many orders do we have?');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a response even when DB context query fails', async () => {
      mockDataSource.query.mockRejectedValue(new Error('DB unavailable'));

      const result = await service.chat('What is the revenue?');
      expect(typeof result).toBe('string');
    });
  });
});
