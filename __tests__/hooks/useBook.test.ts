import { useBook } from '../../src/hooks/useBook';

// Mock WatermelonDB
jest.mock('../../src/db', () => ({
  database: {
    get: jest.fn(() => ({
      find: jest.fn(),
    })),
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
}));

describe('useBook', () => {
  it('should export useBook function', () => {
    expect(typeof useBook).toBe('function');
  });
});
