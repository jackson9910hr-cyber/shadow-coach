import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Services } from '../state/services';
import type { Store } from '../state/store';

export interface AppContextValue {
  store: Store;
  services: Services;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppContext is missing');
  return ctx;
}
