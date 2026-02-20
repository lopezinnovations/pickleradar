export type NameFields = {
  first_name?: string | null;
  last_name?: string | null;
  pickleballer_nickname?: string | null;
};

export function formatDisplayName(u: NameFields): string {
  const first = (u.first_name ?? '').trim();
  const last = (u.last_name ?? '').trim();
  const nick = (u.pickleballer_nickname ?? '').trim();

  const lastInitial = last ? `${last[0].toUpperCase()}.` : '';
  const base = [first, lastInitial].filter(Boolean).join(' ').trim();

  if (base && nick) return `${base} "${nick}"`;
  if (base) return base;
  if (nick) return `"${nick}"`;
  return 'User';
}
