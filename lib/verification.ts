import { supabase } from '@/lib/supabase';

/**
 * Account verification for the open-games feature: only verified accounts
 * can post an open game (see supabase/migrations, open_games_insert_verified
 * policy). This is a fully custom 6-digit code system — our own table, our
 * own RPC to check it, and a Supabase Edge Function (send-verification-code)
 * that emails it via Resend — rather than SMS (needs a paid Twilio-style
 * provider) or Supabase Auth's built-in email OTP (which, for this project,
 * turned out to route existing-password-account requests through its
 * "recovery" token type in a way that made verifying the code always fail —
 * confirmed via the project's auth logs, not just a guess). This sidesteps
 * that entirely by not touching Supabase Auth's OTP machinery at all.
 */

export async function sendVerificationCode(): Promise<void> {
  const { error } = await supabase.functions.invoke('send-verification-code', { method: 'POST' });
  if (error) throw error;
}

export async function confirmVerificationCode(code: string): Promise<void> {
  const { error } = await supabase.rpc('verify_email_code', { p_code: code });
  if (error) throw error;
}

export async function fetchIsVerified(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('is_verified').eq('id', userId).maybeSingle();
  if (error) throw error;
  return Boolean((data as { is_verified?: boolean } | null)?.is_verified);
}
