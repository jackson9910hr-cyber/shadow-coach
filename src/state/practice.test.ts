import { createPractice } from './practice';
import { createStore, type PracticeSentence } from './store';
import { createMemoryRepository } from '../adapters/storage/memoryRepository';
import { createFakeServices } from '../test/fakes';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(opts: Parameters<typeof createFakeServices>[0] = {}, queueSize = 2) {
  const store = createStore(createMemoryRepository(), () => new Date('2026-09-24T08:00:00'));
  await store.init();
  const services = createFakeServices(opts);
  const queue = store.queueFor('business').slice(0, queueSize);
  const practice = createPractice(store, services, queue);
  return { store, services, practice, queue };
}

const say = (s: ReturnType<typeof createFakeServices>, ...alts: string[]) =>
  s.recognition?.onFinal(alts);

describe('practice session (speech recognition)', () => {
  it('plays the sentence with configured rate and tracks playback separately from phase', async () => {
    const { practice, services, store } = await setup();
    await store.updateSettings({ rate: 0.7 });
    practice.listen();
    expect(services.spoken[0]).toMatchObject({
      text: 'Could you share the updated delivery schedule by Friday?',
      options: { rate: 0.7, lang: 'en-US' },
    });
    expect(practice.playing.value).toBe(true);
    expect(practice.phase.value).toBe('ready');
    services.finishSpeech();
    expect(practice.playing.value).toBe(false);

    practice.listen();
    practice.stopAudio();
    expect(practice.playing.value).toBe(false);
  });

  it('scores the best alternative, records the attempt and schedules the card', async () => {
    const { practice, services, store } = await setup();
    practice.startSpeaking();
    expect(practice.phase.value).toBe('listening');
    expect(practice.mode.value).toBe('auto');

    services.recognition?.onInterim?.('could you');
    expect(practice.interim.value).toBe('could you');

    say(services, 'could you share the update delivery schedule on friday', 'nope');
    await flush();
    const r = practice.result.value;
    expect(practice.phase.value).toBe('result');
    expect(r?.score.accuracy).toBe(78);
    expect(r?.graded).toBe(true);
    expect(r?.card?.due).toBe('2026-09-25');
    expect(r?.score.segments.map((s) => s.text)).toEqual([
      'the updated delivery schedule by Friday',
    ]);
    expect(store.stats.value.attempts).toBe(1);
  });

  it('does not start listening while recording and ignores stray taps', async () => {
    const { practice, services } = await setup();
    practice.startSpeaking();
    practice.listen(); // blocked while listening
    expect(services.spoken).toHaveLength(0);
    await practice.stopSpeaking();
    expect(services.recognitionStops).toBe(1);
    await practice.submitSelfGrade(); // not grading -> no-op
    expect(practice.result.value).toBeNull();
  });

  it('practices a segment without changing the schedule, then returns to the full result', async () => {
    const { practice, services, store } = await setup();
    practice.startSpeaking();
    say(services, 'could you share the update delivery schedule on friday');
    await flush();
    const segment = practice.result.value!.score.segments[0]!;

    practice.practiceSegment(segment);
    expect(practice.target.value).toEqual({ kind: 'segment', segment });
    expect(practice.targetText.value).toBe('the updated delivery schedule by Friday');
    practice.listen();
    expect(services.spoken.at(-1)?.text).toBe('the updated delivery schedule by Friday');

    practice.startSpeaking();
    say(services, 'the updated delivery schedule by friday');
    await flush();
    expect(practice.result.value?.score.accuracy).toBe(100);
    expect(practice.result.value?.graded).toBe(false);
    expect(store.stats.value).toMatchObject({ attempts: 1, averageAccuracy: 78 });

    practice.backToFull();
    expect(practice.result.value?.score.accuracy).toBe(78);
    expect(practice.phase.value).toBe('result');
  });

  it('shows an error on no speech and switches to self-grading on network errors', async () => {
    const { practice, services } = await setup();
    practice.startSpeaking();
    services.recognition?.onError('no-speech');
    services.recognition?.onEnd();
    expect(practice.phase.value).toBe('ready');
    expect(practice.error.value).toMatch(/음성이 들리지/);
    expect(practice.mode.value).toBe('auto');

    practice.startSpeaking();
    expect(practice.error.value).toBeNull();
    services.recognition?.onError('network');
    expect(practice.mode.value).toBe('self');
  });

  it('switches to self-grading when offline', async () => {
    const { practice, services } = await setup();
    services.online = false;
    practice.startSpeaking();
    expect(practice.mode.value).toBe('self');
    expect(practice.phase.value).toBe('recording');
  });

  it('advances through the queue, counts completed sentences and finishes', async () => {
    const { practice, services } = await setup();
    practice.startSpeaking();
    say(services, 'could you share the updated delivery schedule by friday');
    await flush();
    practice.retry();
    expect(practice.phase.value).toBe('ready');
    practice.next();
    expect(practice.index.value).toBe(1);
    expect(practice.completed.value).toBe(1);
    expect(practice.current.value?.localId).toBe('biz-002');
    practice.next(); // skipped without attempting
    expect(practice.phase.value).toBe('done');
    expect(practice.completed.value).toBe(1);
    expect(practice.current.value).toBeNull();
    practice.dispose();
  });

  it('is done immediately with an empty queue and ignores speaking', async () => {
    const { store, services } = await setup();
    const practice = createPractice(store, services, [] as PracticeSentence[]);
    expect(practice.phase.value).toBe('done');
    practice.startSpeaking();
    expect(practice.phase.value).toBe('done');
  });
});

describe('practice session (self-grading)', () => {
  it('records, lets the learner mark words, and scores them', async () => {
    const { practice, store } = await setup({ recognition: false });
    expect(practice.mode.value).toBe('self');
    practice.startSpeaking();
    expect(practice.phase.value).toBe('recording');
    await practice.stopSpeaking();
    expect(practice.phase.value).toBe('grading');
    expect(practice.recording.value?.url).toBe('blob:fake');

    practice.toggleMark(3);
    practice.toggleMark(4);
    practice.toggleMark(3);
    expect([...practice.marks.value]).toEqual([4]);
    await practice.submitSelfGrade();
    expect(practice.result.value?.score.accuracy).toBe(89);
    expect(practice.result.value?.transcript).toBeNull();
    expect(store.stats.value.attempts).toBe(1);

    const rec = practice.recording.value!;
    practice.retry();
    expect(rec.dispose).toHaveBeenCalled();
  });

  it('honors the self-grading setting even when recognition is available', async () => {
    const { practice, store } = await setup();
    await store.updateSettings({ grading: 'self' });
    expect(practice.mode.value).toBe('self');
  });

  it('grades without playback when recording is unsupported or denied', async () => {
    const a = await setup({ recognition: false, recorder: false });
    a.practice.startSpeaking();
    await a.practice.stopSpeaking();
    expect(a.practice.phase.value).toBe('grading');
    expect(a.practice.recording.value).toBeNull();

    const b = await setup({ recognition: false, recorder: 'deny' });
    b.practice.startSpeaking();
    await flush();
    expect(b.practice.phase.value).toBe('grading');
    expect(b.practice.error.value).toMatch(/녹음을 시작할 수 없어요/);
    await b.practice.stopSpeaking(); // no-op outside recording
  });
});
