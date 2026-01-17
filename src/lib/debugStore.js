const MAX_EVENTS = 50;
const DEBUG_OVERRIDE_FLAG = '__COURTGAME_DEBUG__';

const createInitialState = () => ({
  events: [],
  lastAction: null,
  flags: {
    bypassJuryLlm: false,
    verboseLogging: false,
  },
});

let debugState = createInitialState();
const listeners = new Set();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const getRuntimeMode = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.MODE) {
    return import.meta.env.MODE;
  }
  return 'production';
};

const hasDebugOverride = () =>
  typeof window !== 'undefined' && window[DEBUG_OVERRIDE_FLAG] === true;

export const debugEnabled = () => hasDebugOverride() || getRuntimeMode() !== 'production';

const shouldLogVerbose = () => debugState.flags.verboseLogging;

const appendEvent = (entry) => {
  debugState = {
    ...debugState,
    events: [...debugState.events, entry].slice(-MAX_EVENTS),
  };
  emitChange();
};

export const logEvent = (message, { verbose = false } = {}) => {
  if (!debugEnabled()) return;
  if (verbose && !shouldLogVerbose()) return;
  appendEvent({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    message,
  });
};

export const setLastAction = (partial) => {
  if (!debugEnabled()) return;
  debugState = {
    ...debugState,
    lastAction: { ...debugState.lastAction, ...partial },
  };
  emitChange();
};

export const setDebugFlag = (flag, value) => {
  if (!debugEnabled()) return;
  debugState = {
    ...debugState,
    flags: {
      ...debugState.flags,
      [flag]: value,
    },
  };
  emitChange();
};

export const getDebugState = () => ({
  events: [...debugState.events],
  lastAction: debugState.lastAction ? { ...debugState.lastAction } : null,
  flags: { ...debugState.flags },
});

export const subscribeDebugStore = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const resetDebugState = () => {
  debugState = createInitialState();
  emitChange();
};

export const __testables = {
  resetDebugState,
  DEBUG_OVERRIDE_FLAG,
};
