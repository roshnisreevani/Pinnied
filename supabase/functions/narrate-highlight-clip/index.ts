// Supabase Edge Function: narrate-highlight-clip
//
// Turns a ready highlight clip's persona commentary (overall + verdict +
// notes) into a short AI voice narration track using Gemini's TTS model,
// wraps the raw PCM audio Gemini returns into a playable WAV file, uploads
// it to the highlight-clips storage bucket, and records the result on the
// clip row. User-triggered (not automatic on analysis) to keep it opt-in
// and avoid burning quota on clips nobody wants narrated.
//
// Needs GEMINI_API_KEY (same secret as analyze-highlight-clip).
// Deploy with: npx supabase functions deploy narrate-highlight-clip

import { createClient } from 'jsr:@supabase/supabase-js@2';

// One prebuilt Gemini voice per persona so narration has a distinct "voice"
// per mode, matching the tone the text itself is already written in.
const VOICE_BY_MODE: Record<string, string> = {
  roast: 'Puck', // playful, a little cocky
  hype: 'Fenrir', // big, energetic
  commentator: 'Charon', // deep, authoritative play-by-play
  critique: 'Kore', // even, clear
};

const STYLE_BY_MODE: Record<string, string> = {
  roast: 'Say this like you are gently roasting a friend over text — playful, teasing, quick:',
  hype: 'Say this like an over-the-top hype man announcer, big energy, almost shouting with excitement:',
  commentator: 'Say this like a live TV sports commentator calling a dramatic play-by-play:',
  critique: 'Say this like a calm, encouraging coach giving real feedback:',
};

// The written notes/verdict were tuned for reading, not for being spoken
// aloud — so narration doesn't just recite them verbatim. Instead, a quick
// text-generation pass improvises a short spoken-style riff from the same
// material, in the same persona, so it sounds like live commentary instead
// of a robot reading captions. Bounded and grounded so it can't wander:
// same clip, same facts, same persona, nothing new invented, nothing long.
const IMPROV_INSTRUCTION_BY_MODE: Record<string, string> = {
  roast: 'a friend riffing out loud while roasting you, casual and funny',
  hype: 'an unhinged hype-man announcer riffing live, big energy',
  commentator: 'a live sports commentator improvising play-by-play energy',
  critique: 'a coach talking through feedback out loud, warm and clear',
};

async function improviseScript(
  geminiApiKey: string,
  mode: string,
  overall: string | null,
  verdict: string | null,
  notes: string[]
): Promise<string> {
  const material = [overall, verdict, ...notes].filter(Boolean).join('\n- ');
  const persona = IMPROV_INSTRUCTION_BY_MODE[mode] ?? IMPROV_INSTRUCTION_BY_MODE.roast;

  const prompt = `You already analyzed a short sports clip and wrote these notes:
- ${material}

Now improvise a SHORT spoken-out-loud version of this, in character as ${persona}. Rules:
- Do not just re-read the notes verbatim — riff on it, add color and personality, say it like you're actually talking, not reading a script.
- Stay on topic: the plays and moments you're riffing on have to be the ones described above, not new ones you make up. You can exaggerate or add flavor to how you describe them, just don't invent a different play/moment that never happened.
- Keep it to 2-3 short sentences, under 280 characters total.
- No profanity, nothing mean-spirited or about anyone's body.
- Output ONLY the spoken line itself, no quotes, no labels, no stage directions.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 1, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini improv error: ${await res.text()}`);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No improvised script returned');
  return text.trim().slice(0, 320);
}

/**
 * Gemini's TTS response is raw 16-bit PCM, mono, 24kHz — not a playable
 * file on its own. Wrapping it in a standard 44-byte WAV header makes it
 * something expo-audio (and every other player) can open directly.
 */
function pcmToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.byteLength, true);

  const wavBytes = new Uint8Array(buffer);
  wavBytes.set(pcm, 44);
  return wavBytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 });
  }

  let clipId: string | undefined;
  try {
    const body = await req.json();
    clipId = body.clipId;
  } catch {
    // fall through
  }
  if (!clipId) {
    return new Response(JSON.stringify({ error: 'clipId is required' }), { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') as string;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

  if (!geminiApiKey) {
    return new Response(JSON.stringify({ error: 'Narration isn\'t configured yet (missing GEMINI_API_KEY).' }), {
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

  const { data: clip, error: clipError } = await adminClient
    .from('highlight_clips')
    .select('id, user_id, mode, status, overall_text, verdict_text')
    .eq('id', clipId)
    .maybeSingle();

  if (clipError || !clip || clip.user_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Clip not found' }), { status: 404 });
  }
  if (clip.status !== 'ready') {
    return new Response(JSON.stringify({ error: 'Clip analysis is not ready yet' }), { status: 400 });
  }

  await adminClient.from('highlight_clips').update({ narration_status: 'pending' }).eq('id', clipId);

  try {
    const mode = (clip.mode as string) ?? 'roast';
    if (!clip.overall_text && !clip.verdict_text) throw new Error('Nothing to narrate yet');

    const { data: noteRows } = await adminClient
      .from('highlight_clip_notes')
      .select('note_text')
      .eq('clip_id', clipId)
      .order('sort_order', { ascending: true });
    const notes = ((noteRows ?? []) as { note_text: string }[]).map((n) => n.note_text);

    const improvised = await improviseScript(
      geminiApiKey,
      mode,
      clip.overall_text as string | null,
      clip.verdict_text as string | null,
      notes
    );

    const prompt = `${STYLE_BY_MODE[mode] ?? STYLE_BY_MODE.roast} ${improvised}`;
    const voice = VOICE_BY_MODE[mode] ?? VOICE_BY_MODE.roast;

    const ttsRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            },
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const detail = await ttsRes.text();
      throw new Error(`Gemini TTS error: ${detail}`);
    }

    const ttsData = await ttsRes.json();
    const part = ttsData?.candidates?.[0]?.content?.parts?.[0];
    const audioB64: string | undefined = part?.inlineData?.data;
    if (!audioB64) throw new Error('No audio returned from Gemini TTS');

    const pcmBytes = base64ToBytes(audioB64);
    const wavBytes = pcmToWav(pcmBytes);

    const path = `${user.id}/narration/${clipId}-${Date.now()}.wav`;
    const { error: uploadError } = await adminClient.storage.from('highlight-clips').upload(path, wavBytes, {
      contentType: 'audio/wav',
      upsert: true,
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = adminClient.storage.from('highlight-clips').getPublicUrl(path);

    await adminClient
      .from('highlight_clips')
      .update({ narration_status: 'ready', narration_audio_url: publicUrlData.publicUrl })
      .eq('id', clipId);

    return new Response(JSON.stringify({ status: 'ready', url: publicUrlData.publicUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await adminClient.from('highlight_clips').update({ narration_status: 'failed' }).eq('id', clipId);
    console.error('[narrate-highlight-clip]', e);
    return new Response(JSON.stringify({ error: `Could not generate narration: ${detail}` }), { status: 500 });
  }
});
