import * as Battery from 'expo-battery';

describe('expo-battery jest mock (E0-1)', () => {
  it('provides addBatteryLevelListener returning unsubscribe', () => {
    const sub = Battery.addBatteryLevelListener(() => {});
    expect(typeof sub.remove).toBe('function');
  });

  it('provides addLowPowerModeListener returning unsubscribe', () => {
    const sub = Battery.addLowPowerModeListener(() => {});
    expect(typeof sub.remove).toBe('function');
  });

  it('provides addBatteryStateListener returning unsubscribe', () => {
    const sub = Battery.addBatteryStateListener(() => {});
    expect(typeof sub.remove).toBe('function');
  });

  it('provides getBatteryLevelAsync', async () => {
    expect(typeof (await Battery.getBatteryLevelAsync())).toBe('number');
  });

  it('provides getBatteryStateAsync', async () => {
    expect(typeof (await Battery.getBatteryStateAsync())).toBe('number');
  });

  it('provides isLowPowerModeEnabledAsync', async () => {
    expect(typeof (await Battery.isLowPowerModeEnabledAsync())).toBe('boolean');
  });
});
