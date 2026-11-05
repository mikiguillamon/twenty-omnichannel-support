/**
 * Pure helpers for n8n integrations to normalize WhatsApp participant IDs.
 * These functions do not use Twenty API and never infer that two different IDs
 * are equivalent unless the provider supplied them together or a verified mapping exists.
 */
export type WhatsappAliasKind = 'WHATSAPP_PN' | 'WHATSAPP_LID';

export type WhatsappAlias = {
  aliasType: WhatsappAliasKind;
  aliasValue: string;
  externalKey: string;
};

export function normalizeWhatsappJid(raw: unknown): { value: string; kind: WhatsappAliasKind } | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().toLowerCase().replace(/:\d+(?=@)/, '');
  if (!/^[0-9]+@(s\.whatsapp\.net|lid)$/.test(value)) return null;
  return { value, kind: value.endsWith('@lid') ? 'WHATSAPP_LID' : 'WHATSAPP_PN' };
}

/** Preserve the complete account scope; do not use just a phone number or an LID as unique key. */
export function whatsappAliases(
  provider: string,
  accountId: string,
  remoteJid: unknown,
  remoteJidAlt: unknown,
): WhatsappAlias[] {
  if (!provider.trim() || !accountId.trim()) throw Error('Provider and accountId are required');
  const result: WhatsappAlias[] = [];
  for (const candidate of [remoteJid, remoteJidAlt]) {
    const normalized = normalizeWhatsappJid(candidate);
    if (!normalized || result.some(item => item.aliasValue === normalized.value)) continue;
    result.push({
      aliasType: normalized.kind,
      aliasValue: normalized.value,
      externalKey: ['WHATSAPP', provider.trim().toLowerCase(), accountId.trim(), normalized.value].join(':'),
    });
  }
  return result;
}

export type AliasLookup = { externalKey: string; externalIdentityId: string };

/**
 * BOTH_FOUND_DIFFERENT means a conflict, not a merge. A missing lookup may be created,
 * but never attach an existing alias to a different identity in an automatic run.
 */
export function resolveAliasLookup(aliasKeys: string[], matches: AliasLookup[]) {
  const expected = new Set(aliasKeys);
  const present = matches.filter(match => expected.has(match.externalKey));
  const ids = [...new Set(present.map(match => match.externalIdentityId))];
  if (ids.length > 1) return { action: 'REVIEW_CONFLICT' as const, externalIdentityId: null };
  if (ids.length === 1) return { action: 'REUSE' as const, externalIdentityId: ids[0] };
  return { action: 'CREATE' as const, externalIdentityId: null };
}
