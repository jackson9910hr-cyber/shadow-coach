import { render, screen } from '@testing-library/preact';
import { App } from './App';

describe('App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Shadow Coach' })).toBeTruthy();
  });
});
