import { numberToWords, splitDisplayWords, tokenize, toWords } from './normalize';

describe('numberToWords', () => {
  it.each([
    [0, 'zero'],
    [7, 'seven'],
    [13, 'thirteen'],
    [20, 'twenty'],
    [42, 'forty two'],
    [100, 'one hundred'],
    [305, 'three hundred five'],
    [1000, 'one thousand'],
    [2026, 'two thousand twenty six'],
    [999999, 'nine hundred ninety nine thousand nine hundred ninety nine'],
  ])('%i -> %s', (n, expected) => {
    expect(numberToWords(n)).toBe(expected);
  });

  it('returns null for out-of-range or non-integer values', () => {
    expect(numberToWords(-1)).toBeNull();
    expect(numberToWords(1_000_000)).toBeNull();
    expect(numberToWords(1.5)).toBeNull();
  });
});

describe('toWords', () => {
  it('lowercases and strips punctuation', () => {
    expect(toWords('Hello, World! How are you?')).toEqual(['hello', 'world', 'how', 'are', 'you']);
  });

  it('normalizes curly apostrophes and expands contractions', () => {
    expect(toWords('I’m sure it’s fine; we’ll see.')).toEqual([
      'i',
      'am',
      'sure',
      'it',
      'is',
      'fine',
      'we',
      'will',
      'see',
    ]);
  });

  it.each([
    ["can't", ['can', 'not']],
    ['cannot', ['can', 'not']],
    ["won't", ['will', 'not']],
    ["shan't", ['shall', 'not']],
    ["don't", ['do', 'not']],
    ["couldn't", ['could', 'not']],
    ["they've", ['they', 'have']],
    ["you're", ['you', 'are']],
    ["she'd", ['she', 'would']],
    ["let's", ['let', 'us']],
    ["that's", ['that', 'is']],
    ["y'all", ['you', 'all']],
  ])('expands %s', (input, expected) => {
    expect(toWords(input)).toEqual(expected);
  });

  it('keeps possessive nouns as a single token without the apostrophe', () => {
    expect(toWords("God's grace")).toEqual(['gods', 'grace']);
  });

  it('treats matching recognizer outputs as equal', () => {
    expect(toWords("I'm OK")).toEqual(toWords('I am okay'));
    expect(toWords('follow-up')).toEqual(toWords('follow up'));
  });

  it('converts digits, times, percentages, ordinals and thousands separators', () => {
    expect(toWords('Meet at 9:30')).toEqual(['meet', 'at', 'nine', 'thirty']);
    expect(toWords('10:05')).toEqual(['ten', 'oh', 'five']);
    expect(toWords('3:00')).toEqual(['three']);
    expect(toWords('up 15%')).toEqual(['up', 'fifteen', 'percent']);
    expect(toWords('the 1st and 22nd')).toEqual(['the', 'first', 'and', 'twenty', 'second']);
    expect(toWords('1,200 units')).toEqual(['one', 'thousand', 'two', 'hundred', 'units']);
  });

  it('leaves huge numbers as digits', () => {
    expect(toWords('12345678')).toEqual(['12345678']);
  });

  it('maps symbols and aliases', () => {
    expect(toWords('R&D & sales')).toEqual(['r', 'and', 'd', 'and', 'sales']);
  });

  it('returns an empty array for empty or punctuation-only input', () => {
    expect(toWords('')).toEqual([]);
    expect(toWords('  ...  —  ')).toEqual([]);
  });
});

describe('tokenize', () => {
  it('maps each token to the index of its display word', () => {
    expect(tokenize("I'm on the follow-up.")).toEqual([
      { word: 'i', source: 0 },
      { word: 'am', source: 0 },
      { word: 'on', source: 1 },
      { word: 'the', source: 2 },
      { word: 'follow', source: 3 },
      { word: 'up', source: 3 },
    ]);
  });

  it('keeps source indices aligned when a display word yields no tokens', () => {
    expect(tokenize('Wait — what?')).toEqual([
      { word: 'wait', source: 0 },
      { word: 'what', source: 2 },
    ]);
  });
});

describe('splitDisplayWords', () => {
  it('splits on any whitespace and drops empties', () => {
    expect(splitDisplayWords('  Hello,\n  world!  ')).toEqual(['Hello,', 'world!']);
  });
});

describe('decimals', () => {
  it('reads decimals digit by digit after "point"', () => {
    expect(toWords('3.25 mm')).toEqual(['three', 'point', 'two', 'five', 'mm']);
  });
  it('keeps unsupported numeric forms as digits', () => {
    expect(toWords('1234567.5')).toEqual(['12345675']);
    expect(toWords('the 1000000th')).toEqual(['the', '1000000th']);
  });
});
