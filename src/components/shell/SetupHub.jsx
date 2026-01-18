import React, { useEffect, useRef, useState } from 'react';
import { Gavel, Scale, Shield } from 'lucide-react';
import {
  COURT_TYPE_OPTIONS,
  DEFAULT_GAME_CONFIG,
  DIFFICULTY_OPTIONS,
  JURISDICTION_OPTIONS,
} from '../../lib/config';
import { COURT_TYPES, SANCTION_STATES } from '../../lib/constants';
import { debugEnabled } from '../../lib/debugStore';
import { AI_PROVIDERS, loadStoredApiKey, persistApiKey } from '../../lib/runtimeConfig';
import InitializationScreen from '../screens/InitializationScreen';

const SANCTIONS_LABELS = Object.freeze({
  [SANCTION_STATES.CLEAN]: 'Clean Record',
  [SANCTION_STATES.WARNED]: 'Warning Issued',
  [SANCTION_STATES.SANCTIONED]: 'Sanctioned',
  [SANCTION_STATES.PUBLIC_DEFENDER]: 'Public Defender Assignment',
  [SANCTION_STATES.RECENTLY_REINSTATED]: 'Reinstated (Grace Period)',
});

const formatSanctionsLabel = (state) => SANCTIONS_LABELS[state] ?? 'Status Unknown';

/**
 * Setup hub for selecting a game mode, jurisdiction, and side.
 *
 * @param {object} props - Component props.
 * @param {(role: string, difficulty: string, jurisdiction: string, courtType: string) => void} props.onStart - Callback to start the game.
 * @param {string | null} props.error - Error message to display when startup fails.
 * @param {object | null} props.sanctionsState - Current sanctions state.
 * @param {import('../../lib/types').PlayerProfile | null} props.profile - Persisted player profile snapshot.
 * @param {boolean} props.isInitializing - Whether setup is starting a run.
 * @param {string | null} props.initializingRole - Role to display while initializing.
 * @returns {JSX.Element} The setup hub layout.
 */
const SetupHub = ({
  onStart,
  error,
  sanctionsState,
  profile,
  isInitializing,
  initializingRole,
}) => {
  const [difficulty, setDifficulty] = useState(DEFAULT_GAME_CONFIG.difficulty);
  const [jurisdiction, setJurisdiction] = useState(DEFAULT_GAME_CONFIG.jurisdiction);
  const [courtType, setCourtType] = useState(DEFAULT_GAME_CONFIG.courtType);
  const storedApiKey = loadStoredApiKey();
  const [provider, setProvider] = useState(AI_PROVIDERS[0]?.value ?? 'gemini');
  const [apiKey, setApiKey] = useState(storedApiKey ?? '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(Boolean(storedApiKey));
  const startGateRef = useRef(false);
  const isPublicDefenderMode = sanctionsState?.state === SANCTION_STATES.PUBLIC_DEFENDER;
  const effectiveCourtType = isPublicDefenderMode ? COURT_TYPES.NIGHT_COURT : courtType;
  const sanctionsLabel = sanctionsState
    ? `Tier ${sanctionsState.level} — ${formatSanctionsLabel(sanctionsState.state)}`
    : 'Tier unknown';
  const pdActive =
    Boolean(profile?.pdStatus) || sanctionsState?.state === SANCTION_STATES.PUBLIC_DEFENDER;
  const disbarred = Boolean(profile?.sanctions?.disbarred);
  const prosecutionDisabled = isPublicDefenderMode || isInitializing;
  const defenseDisabled = isInitializing;

  useEffect(() => {
    persistApiKey(apiKey, rememberKey);
  }, [apiKey, rememberKey]);

  useEffect(() => {
    if (!isInitializing) {
      startGateRef.current = false;
    }
  }, [isInitializing]);

  const handleStart = (role) => {
    if (startGateRef.current || isInitializing) return;
    startGateRef.current = true;
    const effectiveRole = isPublicDefenderMode ? 'defense' : role;
    if (debugEnabled()) {
      console.count('SetupHub start click');
      console.info('[SetupHub] start click', {
        timestamp: new Date().toISOString(),
        appMode: difficulty,
        role: effectiveRole,
        configSnapshot: {
          difficulty,
          jurisdiction,
          courtType: effectiveCourtType,
        },
      });
    }
    onStart(effectiveRole, difficulty, jurisdiction, effectiveCourtType);
  };

  if (isInitializing) {
    return <InitializationScreen role={initializingRole} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6 animate-in fade-in zoom-in duration-500">
      <div className="bg-slate-800 p-6 rounded-full mb-6 shadow-xl border-4 border-amber-500">
        <Scale className="w-16 h-16 text-amber-500" />
      </div>
      <h1 className="text-4xl md:text-6xl font-black text-slate-800 mb-2 tracking-tighter">
        POCKET<span className="text-amber-600">COURT</span>
      </h1>
      <p className="text-slate-500 mb-8 text-lg font-medium max-w-md">v15.0: GitHub Ready Edition</p>
      {error && (
        <div className="w-full max-w-md mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-red-600">Startup error</p>
          <p className="mt-2">{error}</p>
          <p className="mt-2 text-red-600">
            Hint: check your <code className="font-semibold">.env</code> for{' '}
            <code className="font-semibold">VITE_GEMINI_API_KEY</code>.
          </p>
        </div>
      )}
      <div className="w-full max-w-md mb-8 rounded-xl border border-slate-200 bg-white p-4 text-left text-xs text-slate-600 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Status Summary
        </p>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">Sanctions tier</span>
            <span className="text-slate-700">{sanctionsLabel}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-500">Public Defender</span>
            <span className="text-slate-700">{pdActive ? 'Active' : 'Inactive'}</span>
          </div>
          {disbarred && (
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-500">Disbarred</span>
              <span className="text-slate-700">Yes</span>
            </div>
          )}
        </div>
      </div>
      <div className="w-full max-w-md mb-8 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">AI Setup</label>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 focus:border-amber-400 focus:outline-none"
                >
                  {AI_PROVIDERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste your key"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((prev) => !prev)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  If you enable remember, the key is stored in this browser. Browser apps cannot
                  fully secure keys—BYOK is recommended for personal use only.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={rememberKey}
                  onChange={(event) => setRememberKey(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                Remember on this device
              </label>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Game Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDifficulty(option.value)}
                  className={`p-2 rounded-lg text-sm font-bold transition-all border-2 ${
                    difficulty === option.value
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Jurisdiction
            </label>
            <div className="grid grid-cols-3 gap-2">
              {JURISDICTION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setJurisdiction(option.value)}
                  className={`p-2 rounded-lg text-sm font-bold transition-all border-2 ${
                    jurisdiction === option.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
              Court Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COURT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCourtType(option.value)}
                  disabled={isPublicDefenderMode}
                  className={`p-2 rounded-lg text-sm font-bold transition-all border-2 ${
                    effectiveCourtType === option.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'
                  } ${isPublicDefenderMode ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => handleStart('prosecution')}
          disabled={prosecutionDisabled}
          className={`p-4 bg-red-100 hover:bg-red-200 border-2 border-red-300 rounded-xl font-bold text-red-900 flex items-center justify-center gap-2 transition-transform active:scale-95 ${
            prosecutionDisabled ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <Gavel className="w-5 h-5" /> PROSECUTION
        </button>
        <button
          onClick={() => handleStart('defense')}
          disabled={defenseDisabled}
          className={`p-4 bg-blue-100 hover:bg-blue-200 border-2 border-blue-300 rounded-xl font-bold text-blue-900 flex items-center justify-center gap-2 transition-transform active:scale-95 ${
            defenseDisabled ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <Shield className="w-5 h-5" /> {isPublicDefenderMode ? 'PUBLIC DEFENDER' : 'DEFENSE'}
        </button>
      </div>
    </div>
  );
};

export default SetupHub;
