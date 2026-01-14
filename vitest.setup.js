import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.424242);
});

afterEach(() => {
  vi.restoreAllMocks();
});
