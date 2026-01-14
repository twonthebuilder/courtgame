import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.424242);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
