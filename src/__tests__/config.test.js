import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  getEndpointForModel,
  normalizeCourtType,
  normalizeDifficulty,
  resolveLlmConfig,
} from '../lib/config';
import { COURT_TYPES } from '../lib/constants';

describe('difficulty normalization', () => {
  it('maps legacy and unknown difficulty values to canonical ids', () => {
    expect(normalizeDifficulty('regular')).toBe('normal');
    expect(normalizeDifficulty(' Normal ')).toBe('normal');
    expect(normalizeDifficulty('silly')).toBe('silly');
    expect(normalizeDifficulty('nuance')).toBe('nuance');
    expect(normalizeDifficulty('unknown')).toBe(DEFAULT_DIFFICULTY);
  });
});

describe('court type normalization', () => {
  it('maps legacy and unknown court types to canonical ids', () => {
    expect(normalizeCourtType('Municipal Night Court')).toBe(COURT_TYPES.NIGHT_COURT);
    expect(normalizeCourtType('night court')).toBe(COURT_TYPES.NIGHT_COURT);
    expect(normalizeCourtType(COURT_TYPES.SUPREME_COURT)).toBe(COURT_TYPES.SUPREME_COURT);
    expect(normalizeCourtType('unknown')).toBe(COURT_TYPES.STANDARD);
  });
});


describe('LLM configuration resolution', () => {
  it('uses defaults when provider/model are missing', () => {
    expect(resolveLlmConfig({})).toMatchObject({
      provider: DEFAULT_LLM_PROVIDER,
      model: DEFAULT_LLM_MODEL,
      isFallback: false,
      warnings: [],
    });
  });

  it('falls back to defaults when provider/model are unsupported', () => {
    const result = resolveLlmConfig({
      VITE_LLM_PROVIDER: 'unknown-provider',
      VITE_LLM_MODEL: 'unknown-model',
    });

    expect(result).toMatchObject({
      provider: DEFAULT_LLM_PROVIDER,
      model: DEFAULT_LLM_MODEL,
      isFallback: true,
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unsupported provider'),
        expect.stringContaining('Unsupported model'),
      ])
    );
  });

  it('falls back when endpoint override is invalid', () => {
    const result = resolveLlmConfig({ VITE_LLM_ENDPOINT: 'not-a-url' });

    expect(result.isFallback).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid endpoint override')])
    );
    expect(result.endpoint).toContain('generativelanguage.googleapis.com');
  });

  it('throws for unsupported model identifiers in strict endpoint resolution', () => {
    expect(() => getEndpointForModel('gemini', 'gemini-unknown')).toThrow(
      'Unsupported model "gemini-unknown" for provider "gemini"'
    );
  });
});
