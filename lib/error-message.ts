/**
 * Extracts a human-readable message from an unknown thrown value.
 *
 * Needed because supabase-js v2 result errors (`const { error } = await …`)
 * are plain parsed-JSON objects with a `.message` field, NOT Error
 * instances — so the common `e instanceof Error ? e.message : fallback`
 * pattern silently swallows the database's actual explanation (RLS refusals,
 * raised exceptions like "You can only message people you share a connection
 * or group with.", etc.) and shows the generic fallback instead.
 */
export function errorMessage(e: unknown, fallback = 'Unknown error.'): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}
