/**
 * Scope values are stable, unaccented codes so bots can filter consistently.
 * The Twenty object stores an ARRAY; legacy records may have display labels
 * such as "General" and "Campus Hivern" instead of normalized codes.
 */
export const GENERAL_FAQ_SCOPE = 'GENERAL';

export function normalizeFaqScope(value: string): string {
  const scope = value.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_').toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_]{0,63}$/.test(scope)) {
    throw new Error('Usa entre 1 y 64 letras, números o espacios para el alcance.');
  }
  return scope;
}

export function normalizeFaqScopes(values: string[]): string[] {
  if (values.length > 30) throw new Error('Un FAQ no puede tener más de 30 alcances.');
  return [...new Set(values.map(normalizeFaqScope))];
}

/**
 * Twenty 2.50's REST filter parser rejects ARRAY operators, including
 * containsAny and containsIlike. Only publication is filtered in the API.
 * Application code MUST verify every returned record's scope before ranking
 * or returning it, and cap the total number of candidates (fail closed).
 *
 * This is retrieval scoping, NOT an authorization boundary between bots.
 */
export function publishedFaqScopeFilter(scopes: string[]): string {
  normalizeFaqScopes([GENERAL_FAQ_SCOPE, ...scopes]);
  return 'status[eq]:"PUBLISHED"';
}
