import { describe, expect, it } from 'vitest';
import { buildBarStatus } from '../lib/barStatus';
import { SANCTION_STATES } from '../lib/constants';

describe('buildBarStatus', () => {
  it('builds a warning status with timers and next transition', () => {
    const nowMs = Date.parse('2024-01-01T00:00:00.000Z');
    const status = buildBarStatus({
      nowMs,
      sanctions: {
        state: SANCTION_STATES.WARNED,
        level: 1,
        expiresAt: '2024-01-01T00:20:00.000Z',
      },
    });

    expect(status.label).toBe('Warning Issued');
    expect(status.reason).toBe('A warning is currently on file.');
    expect(status.timers).toHaveLength(1);
    expect(status.timers[0].label).toBe('Warning expires');
    expect(status.timers[0].remainingLabel).toBe('20m');
    expect(status.nextTransition?.state).toBe(SANCTION_STATES.CLEAN);
    expect(status.nextTransition?.remainingLabel).toBe('20m');
  });

  it('builds a reinstatement status from the grace period', () => {
    const nowMs = Date.parse('2024-01-01T00:00:00.000Z');
    const status = buildBarStatus({
      nowMs,
      sanctions: {
        state: SANCTION_STATES.RECENTLY_REINSTATED,
        level: 1,
        recentlyReinstatedUntil: '2024-01-01T00:10:00.000Z',
      },
    });

    expect(status.label).toBe('Reinstated (Grace Period)');
    expect(status.timers[0].label).toBe('Reinstatement grace ends');
    expect(status.timers[0].remainingLabel).toBe('10m');
    expect(status.nextTransition?.state).toBe(SANCTION_STATES.CLEAN);
  });

  it('omits expired cooldown timers and transitions', () => {
    const nowMs = Date.parse('2024-01-01T00:00:00.000Z');
    const status = buildBarStatus({
      nowMs,
      sanctions: {
        state: SANCTION_STATES.SANCTIONED,
        level: 2,
        expiresAt: '2023-12-31T23:59:00.000Z',
      },
    });

    expect(status.label).toBe('Sanctioned');
    expect(status.timers).toHaveLength(0);
    expect(status.nextTransition).toBeNull();
  });

  it('tracks active public defender windows even without a sanction state', () => {
    const nowMs = Date.parse('2024-01-01T00:00:00.000Z');
    const status = buildBarStatus({
      nowMs,
      sanctions: { state: SANCTION_STATES.CLEAN, level: 0 },
      pdStatus: {
        startedAt: '2024-01-01T00:00:00.000Z',
        expiresAt: '2024-01-01T01:00:00.000Z',
      },
    });

    expect(status.timers).toHaveLength(1);
    expect(status.timers[0].label).toBe('Public defender ends');
    expect(status.timers[0].remainingLabel).toBe('1h 0m');
    expect(status.nextTransition).toBeNull();
  });

  it('shows reinstatement grace timers from reinstatement snapshots', () => {
    const nowMs = Date.parse('2024-01-01T00:00:00.000Z');
    const status = buildBarStatus({
      nowMs,
      sanctions: { state: SANCTION_STATES.CLEAN, level: 0 },
      reinstatement: {
        startedAt: '2024-01-01T00:00:00.000Z',
        until: '2024-01-01T00:45:00.000Z',
      },
    });

    expect(status.timers).toHaveLength(1);
    expect(status.timers[0].label).toBe('Reinstatement grace ends');
    expect(status.timers[0].remainingLabel).toBe('45m');
  });
});
