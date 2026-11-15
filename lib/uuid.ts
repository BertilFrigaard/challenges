const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Guards ::uuid casts so untrusted input can't make Postgres throw.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
