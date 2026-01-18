import { beforeEach, describe, expect, it } from 'vitest';
import {
  __testables,
  getDebugState,
  logEvent,
  setDebugFlag,
  setLastAction,
} from '../lib/debugStore';

const { DEBUG_OVERRIDE_FLAG, resetDebugState } = __testables;

describe('debugStore', () => {
  beforeEach(() => {
    window[DEBUG_OVERRIDE_FLAG] = true;
    resetDebugState();
  });

  it('stores and caps event log entries', () => {
    for (let i = 0; i < 55; i += 1) {
      logEvent(`event-${i}`);
    }
    const state = getDebugState();
    expect(state.events).toHaveLength(50);
    expect(state.events[0].message).toBe('event-5');
    expect(state.events[49].message).toBe('event-54');
  });

  it('merges last action updates', () => {
    setLastAction({ name: 'submitJuryStrikes', startedAt: 'start' });
    setLastAction({ result: 'success', endedAt: 'end' });
    const state = getDebugState();
    expect(state.lastAction.name).toBe('submitJuryStrikes');
    expect(state.lastAction.startedAt).toBe('start');
    expect(state.lastAction.result).toBe('success');
    expect(state.lastAction.endedAt).toBe('end');
  });

  it('updates debug flags', () => {
    setDebugFlag('verboseLogging', true);
    const state = getDebugState();
    expect(state.flags.verboseLogging).toBe(true);
  });
});
