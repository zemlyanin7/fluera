import { useWordStatus } from '../../src/hooks/useWordStatus';
import { useWordStatusBatch } from '../../src/hooks/useWordStatusBatch';

jest.mock('../../src/db', () => ({
  database: {
    get: jest.fn(() => ({
      query: jest.fn(() => ({
        observe: jest.fn(() => ({
          subscribe: jest.fn((cb: (val: unknown[]) => void) => {
            cb([]);
            return { unsubscribe: jest.fn() };
          }),
        })),
        fetch: jest.fn().mockResolvedValue([]),
      })),
    })),
  },
}));

describe('useWordStatus', () => {
  it('should export useWordStatus function', () => {
    expect(typeof useWordStatus).toBe('function');
  });
});

describe('useWordStatusBatch', () => {
  it('should export useWordStatusBatch function', () => {
    expect(typeof useWordStatusBatch).toBe('function');
  });
});
