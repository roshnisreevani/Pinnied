// Supabase Edge Function: caption-game-photo
//
// The AI "wow factor" feature: writes a short, comedic, low-stakes caption
// for a photo posted to a game's Photo Recap, in the voice of a friend
// ribbing another friend at rec league — never a serious sports-commentary
// or performance-analysis tone, which would clash with this app's whole
// "not Strava" positioning (see CLAUDE.md).
//
// Called from lib/open-games.ts right after a photo upload (fire-and-forget)
// and again if the poster taps "regenerate." Uses Gemini's free tier (Flash
// model) — no billing enabled on the Google Cloud project this key belongs
// to, or the free tier silently disappears for every call.
//
// Needs one secret:
//   npx supabase secrets set GEMINI_API_KEY=your_key_here
// Get a free key (no credit card) at https://aistudio.google.com/apikey
//
// Deploy with:
//   npx supabase functions deploy caption-game-photo

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SYSTEM_PROMPT = `You caption photos from casual, friendly pickup sports games (think office softball team, weekend pickup basketball, a friend's first surf session) — NOT professional sports.

Write ONE short caption (max 140 characters) in a warm, funny, self-deprecating, low-stakes tone — like a friend gently ribbing another friend, never a serious sports announcer or performance coach. No stats, no "elite" language, no coaching feedback, no judgment about skill.

If the photo is blurry, unclear, or you genuinely can't tell what's happening, write something vague but validating instead of guessing specifics — e.g. "Can't quite tell what's going on here, but the energy is immaculate."

If the photo doesn't look like it's from a sports/game context at all, or you're not comfortable captioning it, respond with exactly: SKIP

Respond with ONLY the caption text (or SKIP), nothing else — no quotes, no preamble.`;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  let photoId: string | undefined;
  try {
    const body = await req.json();
    photoId = body.photoId;
  } catch {
    // fall through to the missing-photoId check below
  }
  if (!photoId) {
    return new Response(JSON.stringify({ error: 'photoId is required' }), { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'Captioning isn\'t configured yet (missing GEMINI_API_KEY).' }), {
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
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Could not verify caller' }), { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: photo, error: photoError } = await adminClient
    .from('game_photos')
    .select('id, user_id, photo_url, game_id, open_games!inner(created_by)')
    .eq('id', photoId)
    .maybeSingle();

  if (photoError || !photo) {
    return new Response(JSON.stringify({ error: 'Photo not found' }), { status: 404 });
  }

  const organizerId = (photo as unknown as { open_games: { created_by: string } }).open_games.created_by;
  if (photo.user_id !== user.id && organizerId !== user.id) {
    return new Response(JSON.stringify({ error: 'Not allowed to caption this photo' }), { status: 403 });
  }

  try {
    const imageRes = await fetch(photo.photo_url as string);
    if (!imageRes.ok) throw new Error('Could not fetch photo');
    const contentType = imageRes.headers.get('content-type') ?? 'image/jpeg';
    const bytes = new Uint8Array(await imageRes.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type: contentType, data: base64 } }],
            },
          ],
          generationConfig: { maxOutputTokens: 80, temperature: 0.9 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const detail = await geminiRes.text();
      throw new Error(`Gemini error: ${detail}`);
    }

    const geminiData = await geminiRes.json();
    const rawText: string | undefined = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    const caption = rawText?.trim();

    if (!caption || caption === 'SKIP') {
      await adminClient.from('game_photos').update({ caption: null, caption_status: 'skipped' }).eq('id', photoId);
      return new Response(JSON.stringify({ status: 'skipped' }), { status: 200 });
    }

    await adminClient
      .from('game_photos')
      .update({ caption: caption.slice(0, 200), caption_status: 'ready' })
      .eq('id', photoId);

    return new Response(JSON.stringify({ status: 'ready', caption }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // Captioning is a delight-layer, not core functionality — fail soft so a
    // Gemini hiccup never blocks or breaks the photo upload itself.
    await adminClient.from('game_photos').update({ caption_status: 'failed' }).eq('id', photoId);
    console.error('[caption-game-photo]', e);
    return new Response(JSON.stringify({ error: 'Could not generate a caption' }), { status: 500 });
  }
});
