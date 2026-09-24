import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { App } from './App';
import { navigate, practiceRequest } from './router';
import { createMemoryRepository } from '../adapters/storage/memoryRepository';
import { createStore } from '../state/store';
import { createFakeServices } from '../test/fakes';

async function renderApp(opts: Parameters<typeof createFakeServices>[0] = {}) {
  const store = createStore(createMemoryRepository(), () => new Date('2026-09-24T08:00:00'));
  await store.init();
  const services = createFakeServices(opts);
  practiceRequest.value = null;
  navigate('home');
  const utils = render(<App value={{ store, services }} />);
  return { store, services, ...utils };
}

const click = (el: HTMLElement) => fireEvent.click(el);
const button = (name: RegExp | string) => screen.getByRole('button', { name });

afterEach(() => {
  location.hash = '';
});

describe('App', () => {
  it('shows today stats, the queue size and navigation', async () => {
    await renderApp();
    expect(screen.getByRole('heading', { level: 1, name: '오늘의 섀도잉' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /학습할 문장\s+10개/ })).toBeTruthy();
    expect(screen.getByText('평균 정확도')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: '주요 메뉴' });
    expect(within(nav).getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page');
  });

  it('filters the queue by category', async () => {
    await renderApp();
    click(button('교회'));
    expect(screen.getByRole('heading', { name: /학습할 문장\s+8개/ })).toBeTruthy();
    expect(button('교회').getAttribute('aria-pressed')).toBe('true');
  });

  it('runs a full practice loop: listen, speak, score, retry segment, next', async () => {
    const { services } = await renderApp();
    click(button(/학습 시작/));
    expect(
      screen.getByText('Could you share the updated delivery schedule by Friday?'),
    ).toBeTruthy();
    expect(screen.getByText('금요일까지 수정된 납기 일정을 공유해 주시겠어요?')).toBeTruthy();

    click(button(/원문 듣기/));
    expect(services.spoken[0]?.text).toMatch(/^Could you share/);
    expect(button(/정지/)).toBeTruthy();
    click(button(/정지/));

    click(button(/1\.0×/));
    click(button(/0\.7×/));
    expect(button(/0\.7×/).getAttribute('aria-pressed')).toBe('true');

    click(button(/따라 말하기/));
    expect(screen.getByText('듣는 중… 문장을 말해 주세요.')).toBeTruthy();
    services.recognition?.onFinal(['could you share the update delivery schedule on friday']);

    await screen.findByText('78%');
    expect(screen.getByText('→ update')).toBeTruthy();
    expect(screen.getByText('틀림, 들린 말: on')).toBeTruthy();
    expect(screen.getByText('다음 복습: 내일')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('정확도 78퍼센트, 틀린 단어 2개');

    click(button(/the updated delivery schedule by Friday/));
    expect(screen.getByText('구간 연습')).toBeTruthy();
    click(button(/따라 말하기/));
    services.recognition?.onFinal(['the updated delivery schedule by friday']);
    await screen.findByText('100%');
    click(button(/전체 문장으로/));
    await screen.findByText('78%');

    click(button(/다음 문장/));
    expect(
      screen.getByText('We need to confirm the inspection date with the supplier.'),
    ).toBeTruthy();
  });

  it('shows recognition errors', async () => {
    const { services } = await renderApp();
    click(button(/학습 시작/));
    click(button(/따라 말하기/));
    click(button(/멈추기/));
    services.recognition?.onError('no-speech');
    await screen.findByText(/음성이 들리지 않았어요/);
  });

  it('supports the self-grading flow when recognition is unavailable', async () => {
    await renderApp({ recognition: false });
    expect(screen.getByText(/음성인식을 지원하지 않아/)).toBeTruthy();
    click(button(/학습 시작/));
    click(button(/따라 말하기/));
    expect(screen.getByText(/말을 마치면/)).toBeTruthy();
    click(button(/멈추기/));
    await screen.findByText('내 목소리 듣기');
    const word = button('updated');
    click(word);
    expect(word.getAttribute('aria-pressed')).toBe('true');
    click(button(/채점 완료/));
    await screen.findByText('89%');
    expect(screen.getByText('직접 표시')).toBeTruthy();
  });

  it('finishes a session and shows the summary', async () => {
    const { store } = await renderApp();
    await store.updateSettings({ newPerDay: 3 });
    click(button(/학습 시작/));
    click(button(/건너뛰기/));
    click(button(/건너뛰기/));
    click(button(/건너뛰기/));
    expect(screen.getByRole('heading', { name: /세션 완료/ })).toBeTruthy();
    click(button('홈으로'));
    expect(screen.getByRole('heading', { level: 1, name: '오늘의 섀도잉' })).toBeTruthy();
  });

  it('shows a prompt when the practice route is opened directly', async () => {
    await renderApp();
    navigate('practice');
    await screen.findByText('연습할 문장을 먼저 선택하세요.');
  });

  it('lists sentences in the library and practices a single one', async () => {
    await renderApp();
    navigate('library');
    await screen.findByRole('heading', { level: 1, name: '문장 목록' });
    expect(screen.getByText('30문장')).toBeTruthy();
    click(button('일상'));
    expect(screen.getByText('7문장')).toBeTruthy();
    click(button('연습: How was your weekend?'));
    expect(screen.getByText('How was your weekend?')).toBeTruthy();
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });

  it('changes settings and applies the theme', async () => {
    const { store } = await renderApp();
    navigate('settings');
    await screen.findByRole('heading', { level: 1, name: '설정' });
    click(button('다크'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    click(button('시스템'));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    click(button('자가채점'));
    expect(store.settings.value.grading).toBe('self');
    fireEvent.change(screen.getByLabelText('하루 새 문장 수'), { target: { value: '5' } });
    expect(store.settings.value.newPerDay).toBe(5);
    fireEvent.click(screen.getByLabelText('한국어 뜻 기본 표시'));
    expect(store.settings.value.showKo).toBe(false);
  });

  it('imports a sentence set file', async () => {
    const { store } = await renderApp();
    navigate('settings');
    const input = (await screen.findByText(/JSON 파일로 세트 추가/)).querySelector(
      'input',
    ) as HTMLInputElement;
    const file = new File(
      [
        JSON.stringify({
          id: 'mine',
          title: 'Mine',
          version: 1,
          sentences: [{ id: '1', text: 'Amen.', category: 'church' }],
        }),
      ],
      'mine.json',
      { type: 'application/json' },
    );
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText(/"Mine" 세트\(1문장\)를 추가했습니다/);
    expect(store.sentences.value).toHaveLength(31);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mine 세트 삭제' })).toBeTruthy(),
    );
  });

  it('warns when storage is unavailable', async () => {
    const { store } = await renderApp();
    store.storageError.value = true;
    await screen.findByText(/저장소를 사용할 수 없어/);
  });
});
