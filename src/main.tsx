import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './app/App';
import { createWebRecorder } from './adapters/recorder/webRecorder';
import { createWebRecognizer } from './adapters/speech/webRecognizer';
import { createIdbRepository } from './adapters/storage/idbRepository';
import { createMemoryRepository } from './adapters/storage/memoryRepository';
import { createWebTts } from './adapters/tts/webTts';
import { createStore } from './state/store';
import type { Services } from './state/services';

const repo = typeof indexedDB === 'undefined' ? createMemoryRepository() : createIdbRepository();
const store = createStore(repo);
const services: Services = {
  tts: createWebTts(),
  recognizer: createWebRecognizer(),
  recorder: createWebRecorder(),
  isOnline: () => navigator.onLine,
};

// Ask the browser not to evict learning data (Safari may otherwise clear it after inactivity).
void navigator.storage?.persist?.().catch(() => false);

// The calendar day can change while the app stays open overnight.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') store.refreshToday();
  else services.tts.cancel();
});

void store.init();

const root = document.getElementById('app');
if (root) render(<App value={{ store, services }} />, root);
