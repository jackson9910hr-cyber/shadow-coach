import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('sanitizeSettings', () => {
  it('returns defaults for non-objects', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values', () => {
    const s = {
      rate: 0.7,
      theme: 'dark',
      showKo: false,
      newPerDay: 5,
      grading: 'self',
      voiceURI: 'v1',
    };
    expect(sanitizeSettings(s)).toEqual(s);
  });

  it('replaces invalid values with defaults', () => {
    expect(
      sanitizeSettings({
        rate: 3,
        theme: 'pink',
        showKo: 'yes',
        newPerDay: 1000,
        grading: 'x',
        voiceURI: 5,
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ newPerDay: 2.5 }).newPerDay).toBe(DEFAULT_SETTINGS.newPerDay);
  });
});
