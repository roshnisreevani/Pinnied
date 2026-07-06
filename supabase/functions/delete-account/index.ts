// Supabase Edge Function: delete-account
//
// Deletes everything that belongs to the calling user: their files in the
// "avatars" and "pick-three" storage buckets, and their auth.users record
// (which cascades to delete their profiles row automatically, since
// profiles.id references auth.users with ON DELETE CASCADE).
//
// This all has to happen server-side because deleting a storage object
// outside your own folder or deleting an auth user both require the service
// role key, which must never be shipped inside the app.
//
// Deploy with the Supabase CLI (see README.md in this folder for the full
// walkthrough):
//   npx supabase login
//   npx supabase link --project-ref dtrjnvbldzyqjtbuceou
//   npx supabase functions deploy delete-account

import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKETS = ['avatars', 'pick-three'];

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  // SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
  // provided automatically by the Edge Functions runtime — no manual secret
  // setup needed.
  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

  // Client scoped to the caller's own JWT, purely to verify who's asking.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Could not verify caller' }), { status: 401 });
  }

  // Admin client, service-role only, only ever runs inside this function.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  for (const bucket of BUCKETS) {
    const { data: files, error: listError } = await adminClient.storage.from(bucket).list(user.id);
    if (listError) {
      return new Response(JSON.stringify({ error: `Failed listing ${bucket}: ${listError.message}` }), {
        status: 500,
      });
    }
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
      if (removeError) {
        return new Response(JSON.stringify({ error: `Failed deleting ${bucket}: ${removeError.message}` }), {
          status: 500,
        });
      }
    }
  }

  // Cascades to delete the profiles row too (ON DELETE CASCADE).
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
