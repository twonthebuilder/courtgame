/**
 * Normalize juror IDs to a canonical numeric type.
 *
 * @param {unknown} id - Juror identifier from UI, state, or LLM payloads.
 * @returns {number | null} Canonical numeric ID, or null when normalization fails.
 */
export const normalizeJurorId = (id) => {
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (typeof id === 'string') {
    const trimmed = id.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

/**
 * Normalize a list of juror IDs to canonical numeric values, filtering invalid entries.
 *
 * @param {unknown} ids - Array of juror identifiers.
 * @returns {number[]} Canonical juror IDs.
 */
export const normalizeStrikeIds = (ids) => {
  if (!Array.isArray(ids)) return [];
  return ids.map(normalizeJurorId).filter((id) => id !== null);
};

/**
 * Ensure juror IDs are canonical and deterministic for the run.
 * IDs are assigned sequentially based on the original array order.
 *
 * @param {unknown} jurors - Array of juror objects.
 * @returns {Array<object>} Jurors with canonical numeric IDs.
 */
export const canonicalizeJurorPool = (jurors) => {
  if (!Array.isArray(jurors)) return [];
  return jurors.map((juror, index) => ({
    ...juror,
    id: index + 1,
  }));
};

/**
 * Validate strike IDs against an allowed pool.
 *
 * @param {unknown} strikes - Array of IDs to validate.
 * @param {unknown} poolIds - Array of allowed juror IDs.
 * @returns {{ ok: boolean, invalidIds: Array<unknown> }}
 */
export const validateStrikeIds = (strikes, poolIds) => {
  if (!Array.isArray(strikes)) return { ok: false, invalidIds: [] };

  const normalizedPoolIds = Array.isArray(poolIds)
    ? poolIds.map(normalizeJurorId).filter((id) => id !== null)
    : [];
  const poolSet = new Set(normalizedPoolIds);
  const invalidIds = [];
  const seen = new Set();

  strikes.forEach((strike) => {
    const normalized = normalizeJurorId(strike);
    if (normalized === null) {
      invalidIds.push(strike);
      return;
    }
    if (seen.has(normalized)) {
      invalidIds.push(normalized);
      return;
    }
    seen.add(normalized);
    if (!poolSet.has(normalized)) {
      invalidIds.push(normalized);
    }
  });

  return { ok: invalidIds.length === 0, invalidIds };
};
