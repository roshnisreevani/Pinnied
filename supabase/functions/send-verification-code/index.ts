// Supabase Edge Function: send-verification-code
//
// Generates a 6-digit code, stores it in public.verification_codes (service
// role, bypasses RLS — that table has no client-facing policies on purpose),
// and emails it via Resend. This exists because Supabase Auth's own
// email-OTP flow turned out to route existing-password-account requests
// through its "recovery" token type in a way that made verifying the code
// always fail — see lib/verification.ts for the full story. This function
// sidesteps Supabase Auth's OTP machinery entirely.
//
// Needs one secret that Supabase doesn't provide automatically:
//   npx supabase secrets set RESEND_API_KEY=re_your_key_here
// Get a free key at https://resend.com (no credit card required).
//
// Deploy with:
//   npx supabase functions deploy send-verification-code

import { createClient } from 'jsr:@supabase/supabase-js@2';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'Email sending isn\'t configured yet (missing RESEND_API_KEY).' }), {
      status: 500,
    });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user || !user.email) {
    return new Response(JSON.stringify({ error: 'Could not verify caller' }), { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Rate limit: don't let someone spam themselves (or someone else via a
  // guessed user id) with sends. One every 30 seconds is plenty.
  const { data: recent } = await adminClient
    .from('verification_codes')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at as string).getTime() < 30_000) {
    return new Response(JSON.stringify({ error: 'Wait a bit before requesting another code.' }), { status: 429 });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await adminClient.from('verification_codes').insert({
    user_id: user.id,
    email: user.email,
    code,
    expires_at: expiresAt,
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Pinnied <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Your Pinnied verification code',
      html: `
        <h2>Verify your account</h2>
        <p>Enter this code in the app to verify your account:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">${code}</p>
        <p>This code expires in 10 minutes and can only be used once.</p>
      `,
    }),
  });

  if (!emailRes.ok) {
    const detail = await emailRes.text();
    return new Response(JSON.stringify({ error: `Could not send email: ${detail}` }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
