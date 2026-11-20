export function readTag(value: unknown): string {
  if (typeof value !== 'string') return '';
  const tag = value.trim();
  return tag.length <= 120 && !/[\u0000-\u001f\u007f]/.test(tag) ? tag : '';
}

function tagKey(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('es');
}

export function stringTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = new Map<string, string>();
  for (const raw of value) {
    const tag = readTag(raw);
    const key = tagKey(tag);
    if (tag && !tags.has(key)) tags.set(key, tag);
  }
  return [...tags.values()];
}

export function hasTag(value: unknown, sought: string): boolean {
  const key = tagKey(readTag(sought));
  return Boolean(key) && stringTags(value).some(tag => tagKey(tag) === key);
}
