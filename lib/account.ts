import { supabase } from '@/lib/supabase';

/**
 * Full account deletion. All of the actual destructive work — removing the
 * user's files from both storage buckets, deleting the auth user (which
 * cascades to delete their profiles row) — happens inside the
 * delete-account Edge Function, which is the only place the service role
 * key exists. See supabase/functions/delete-account.
 *
 * This just calls that function, then clears the local session so the app
 * returns to the Auth screen right away.
 */
export async function deleteAccount(_userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  await supabase.auth.signOut();
}
