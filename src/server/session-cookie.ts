export const SESSION_COOKIE = "mn_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(v: string | undefined | null): v is string {
  return !!v && UUID_RE.test(v);
}
