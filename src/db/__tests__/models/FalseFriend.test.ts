import { FalseFriendModel } from '@/db/models/FalseFriend';

describe('FalseFriendModel', () => {
  it('table name = false_friends', () => {
    expect(FalseFriendModel.table).toBe('false_friends');
  });
});
