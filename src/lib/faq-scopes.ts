/**
 * Scope values are stable, unaccented codes so bots can filter consistently.
 * They remain arbitrary (ARRAY), unlike a predeclared MULTI_SELECT option list.
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
 * A bot requests its own scopes plus GENERAL. Empty FAQ scopeTags never match.
 * This generates a REST filter but is not an authorization boundary.
 */
/** Twenty 2.50 ARRAY supports containsIlike, not MULTI_SELECT's containsAny.
 * No % wildcards are used: match complete array elements only.
 */
export function faqScopePredicate(scopes: string[]): string {
  const allowed = normalizeFaqScopes([GENERAL_FAQ_SCOPE, ...scopes]);
  const clauses = allowed.map(scope =>
    'scopeTags[containsIlike]:' + JSON.stringify(scope.replace(/[\\%_]/g, '\\$&')));
  return clauses.length === 1 ? clauses[0] : 'or(' + clauses.join(',') + ')';
}

/** Scope restricts results, but is not a workspace authorization boundary. */
export function publishedFaqScopeFilter(scopes: string[]): string {
  return 'and(status[eq]:"PUBLISHED",' + faqScopePredicate(scopes) + ')';
}
