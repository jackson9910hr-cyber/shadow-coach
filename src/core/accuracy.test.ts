import { accuracyOf, pickBestTranscript, scoreAttempt, scoreSelfGrade } from './accuracy';

describe('accuracyOf', () => {
  it('is matches / reference words, rounded to an integer percent', () => {
    expect(
      accuracyOf([
        { op: 'match', ref: 'a', hyp: 'a', refIndex: 0 },
        { op: 'sub', ref: 'b', hyp: 'c', refIndex: 1 },
        { op: 'match', ref: 'd', hyp: 'd', refIndex: 2 },
        { op: 'ins', hyp: 'e' },
      ]),
    ).toBe(67);
  });

  it('returns 0 when there are no reference words', () => {
    expect(accuracyOf([])).toBe(0);
    expect(accuracyOf([{ op: 'ins', hyp: 'x' }])).toBe(0);
  });
});

describe('scoreAttempt', () => {
  it('gives 100 when the transcript differs only in surface form', () => {
    const r = scoreAttempt("I'm grateful for God's grace.", 'i am grateful for gods grace');
    expect(r.accuracy).toBe(100);
    expect(r.wrongDisplayIndices).toEqual([]);
    expect(r.segments).toEqual([]);
  });

  it('flags the display words that contain errors', () => {
    const r = scoreAttempt(
      'Could you send the updated schedule?',
      'could you send updated schedules',
    );
    expect(r.accuracy).toBe(67);
    expect(r.displayWords).toEqual(['Could', 'you', 'send', 'the', 'updated', 'schedule?']);
    expect(r.wrongDisplayIndices).toEqual([3, 5]);
  });

  it('maps error segments to display-word ranges with retry text', () => {
    const r = scoreAttempt(
      "Let's review the delivery schedule together.",
      "let's review the delivery together",
      { context: 0, mergeGap: 0 },
    );
    expect(r.segments).toEqual([{ start: 4, end: 4, text: 'schedule' }]);
  });

  it('marks a contraction display word wrong if any of its tokens is wrong', () => {
    const r = scoreAttempt("I'm ready", 'i was ready', { context: 0, mergeGap: 0 });
    expect(r.wrongDisplayIndices).toEqual([0]);
    expect(r.segments).toEqual([{ start: 0, end: 0, text: "I'm" }]);
  });

  it('strips leading/trailing punctuation from retry text', () => {
    const r = scoreAttempt('Yes, “amen.”', 'yes', { context: 0, mergeGap: 0 });
    expect(r.segments).toEqual([{ start: 1, end: 1, text: 'amen' }]);
  });

  it('scores an empty transcript as 0', () => {
    expect(scoreAttempt('Good morning', '').accuracy).toBe(0);
  });
});

describe('scoreSelfGrade', () => {
  it('scores by the display words the learner marked wrong', () => {
    const r = scoreSelfGrade("I'm ready to go now.", [0], { context: 0, mergeGap: 0 });
    // "I'm" expands to 2 of 6 tokens -> 4/6
    expect(r.accuracy).toBe(67);
    expect(r.wrongDisplayIndices).toEqual([0]);
    expect(r.segments).toEqual([{ start: 0, end: 0, text: "I'm" }]);
  });

  it('gives 100 when nothing is marked and ignores out-of-range indices', () => {
    const r = scoreSelfGrade('Pray without ceasing.', [7, -1]);
    expect(r.accuracy).toBe(100);
    expect(r.wrongDisplayIndices).toEqual([]);
  });
});

describe('pickBestTranscript', () => {
  it('chooses the alternative with the highest accuracy', () => {
    const r = pickBestTranscript('We love him', ['we loved him', 'we love him', 'wee love hymn']);
    expect(r.transcript).toBe('we love him');
    expect(r.score.accuracy).toBe(100);
  });

  it('keeps the first alternative on ties', () => {
    expect(pickBestTranscript('a b', ['a x', 'a y']).transcript).toBe('a x');
  });

  it('handles an empty alternative list', () => {
    const r = pickBestTranscript('Hello', []);
    expect(r.transcript).toBe('');
    expect(r.score.accuracy).toBe(0);
  });
});
