import * as FileSystem from 'expo-file-system/legacy';
import { stagingCopy } from '../stagingCopy';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/docs/',
  makeDirectoryAsync: jest.fn(async () => {}),
  copyAsync: jest.fn(async () => {}),
}));

describe('stagingCopy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('copies to books/_tmp with random uuid name', async () => {
    const out = await stagingCopy({ uri: 'file:///src.epub', name: 'src.epub', size: 1000 });
    expect(out).toMatch(/^\/mock\/docs\/books\/_tmp\/[a-f0-9-]+\.epub$/);
    expect(FileSystem.copyAsync).toHaveBeenCalled();
  });

  it('preserves fb2 extension', async () => {
    const out = await stagingCopy({ uri: 'file:///b.fb2', name: 'b.fb2', size: 500 });
    expect(out.endsWith('.fb2')).toBe(true);
  });

  it('defaults to .bin for unknown extension', async () => {
    const out = await stagingCopy({ uri: 'file:///x', name: 'x', size: 0 });
    expect(out.endsWith('.bin')).toBe(true);
  });
});
