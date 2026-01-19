import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../components/ui/ErrorBoundary';

const Boom = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  it('renders fallback UI when a child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary showDetails={false}>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Pocket Court hit a snag');
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByText(/Diagnostic:/i)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('shows error details when debug is enabled', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary showDetails>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error details/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/boom/i).length).toBeGreaterThan(0);

    consoleError.mockRestore();
  });
});
