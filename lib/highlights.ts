import type { SkillLevel } from '@/lib/open-games';
import { supabase } from '@/lib/supabase';
import { uploadHighlightClipVideo } from '@/lib/upload-photo';

export type HighlightMode = 'roast' | 'critique';
export type HighlightStatus = 'pending' | 'ready' | 'failed';
export type HighlightVisibility = 'private' | 'profile' | 'feed';

export type HighlightClip = {
  id: string;
  userId: string;
  mode: HighlightMode;
  sport: string | null;
  skillLevel: SkillLevel | null;
  videoUrl: string;
  overallText: string | null;
  status: HighlightStatus;
  errorMessage: string | null;
  visibility: HighlightVisibility;
  createdAt: string;
  archivedAt: string | null;
};

export type HighlightNote = {
  id: string;
  timestampSeconds: number;
  noteText: string;
};

export type HighlightMessage = {
  id: string;
  sender: 'user' | 'ai';
  body: string;
  createdAt: string;
};

type ClipRow = {
  id: string;
  user_id: string;
  mode: HighlightMode;
  sport: string | null;
  skill_level: SkillLevel | null;
  video_url: string;
  overall_text: string | null;
  status: HighlightStatus;
  error_message: string | null;
  visibility: HighlightVisibility;
  created_at: string;
  archived_at: string | null;
};

function rowToClip(row: ClipRow): HighlightClip {
  return {
    id: row.id,
    userId: row.user_id,
    mode: row.mode,
    sport: row.sport,
    skillLevel: row.skill_level,
    videoUrl: row.video_url,
    overallText: row.overall_text,
    status: row.status,
    errorMessage: row.error_message,
    visibility: row.visibility,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

const CLIP_SELECT =
  'id, user_id, mode, sport, skill_level, video_url, overall_text, status, error_message, visibility, created_at, archived_at';

/**
 * Uploads the clip and creates its row (status 'pending'), then fires the
 * analyze-highlight-clip Edge Function and returns immediately — analysis
 * happens async, the caller polls fetchHighlightClip for status to flip.
 */
export async function createHighlightClip(input: {
  userId: string;
  localVideoUri: string;
  mode: HighlightMode;
  sport: string | null;
  skillLevel: SkillLevel | null;
}): Promise<string> {
  const videoUrl = await uploadHighlightClipVideo(input.userId, input.localVideoUri);

  const { data, error } = await supabase
    .from('highlight_clips')
    .insert({
      user_id: input.userId,
      mode: input.mode,
      sport: input.sport,
      skill_level: input.skillLevel,
      video_url: videoUrl,
    })
    .select('id')
    .single();

  if (error) throw error;
  const clipId = (data as { id: string }).id;

  supabase.functions.invoke('analyze-highlight-clip', { body: { clipId } }).catch((e) => {
    console.warn('[highlights] analyze request failed:', e);
  });

  return clipId;
}

/** Re-fires analysis for a clip stuck in 'pending' or that previously 'failed'. */
export function retryHighlightAnalysis(clipId: string): Promise<{ error: Error | null }> {
  return supabase.functions.invoke('analyze-highlight-clip', { body: { clipId } }).then(
    ({ error }) => ({ error: error ? new Error(error.message) : null }),
    (e) => ({ error: e instanceof Error ? e : new Error('Could not start analysis') })
  );
}

export async function fetchHighlightClip(clipId: string): Promise<HighlightClip | null> {
  const { data, error } = await supabase.from('highlight_clips').select(CLIP_SELECT).eq('id', clipId).maybeSingle();
  if (error) throw error;
  return data ? rowToClip(data as unknown as ClipRow) : null;
}

/** Active (non-archived) clips only — archived ones live in fetchArchivedHighlightClips. */
export async function fetchMyHighlightClips(userId: string): Promise<HighlightClip[]> {
  const { data, error } = await supabase
    .from('highlight_clips')
    .select(CLIP_SELECT)
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ClipRow[]).map(rowToClip);
}

export async function fetchArchivedHighlightClips(userId: string): Promise<HighlightClip[]> {
  const { data, error } = await supabase
    .from('highlight_clips')
    .select(CLIP_SELECT)
    .eq('user_id', userId)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as ClipRow[]).map(rowToClip);
}

/** Moves a clip to Archive — same soft-delete pattern as Feed posts, so nothing is lost by accident. */
export async function archiveHighlightClip(clipId: string): Promise<void> {
  const { error } = await supabase
    .from('highlight_clips')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', clipId);
  if (error) throw error;
}

export async function unarchiveHighlightClip(clipId: string): Promise<void> {
  const { error } = await supabase.from('highlight_clips').update({ archived_at: null }).eq('id', clipId);
  if (error) throw error;
}

export async function fetchHighlightNotes(clipId: string): Promise<HighlightNote[]> {
  const { data, error } = await supabase
    .from('highlight_clip_notes')
    .select('id, timestamp_seconds, note_text')
    .eq('clip_id', clipId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ id: string; timestamp_seconds: number; note_text: string }>).map(
    (row) => ({ id: row.id, timestampSeconds: row.timestamp_seconds, noteText: row.note_text })
  );
}

export async function fetchHighlightMessages(clipId: string): Promise<HighlightMessage[]> {
  const { data, error } = await supabase
    .from('highlight_clip_messages')
    .select('id, sender, body, created_at')
    .eq('clip_id', clipId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ id: string; sender: 'user' | 'ai'; body: string; created_at: string }>).map(
    (row) => ({ id: row.id, sender: row.sender, body: row.body, createdAt: row.created_at })
  );
}

/**
 * Sends a message and returns the AI's reply — the Edge Function stores both
 * sides. Pass quotedNote when the user tapped a specific note to reply to —
 * it gets woven into the stored bubble and into what the AI sees, so the
 * reply actually answers about that point.
 */
export async function sendHighlightMessage(clipId: string, message: string, quotedNote?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('highlight-clip-chat', {
    body: { clipId, message, quotedNote },
  });
  if (error) throw error;
  return (data as { reply: string }).reply;
}

/**
 * Keep-private / post-to-profile / share-to-feed. Sharing to feed creates a
 * real posts row (video only — the AI critique/roast never leaves this
 * table) and remembers the resulting post id so it isn't double-posted.
 */
export async function setHighlightVisibility(
  clip: HighlightClip,
  visibility: HighlightVisibility,
  authorId: string
): Promise<void> {
  if (visibility === 'feed' && clip.visibility !== 'feed') {
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        author_id: authorId,
        group_id: null,
        sport_tag: clip.sport,
        caption: clip.mode === 'roast' ? 'Roasted 🔥' : 'Getting critiqued 🎯',
        media_url: clip.videoUrl,
        media_type: 'video',
      })
      .select('id')
      .single();
    if (postError) throw postError;

    const { error } = await supabase
      .from('highlight_clips')
      .update({ visibility, shared_post_id: (post as { id: string }).id })
      .eq('id', clip.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('highlight_clips').update({ visibility }).eq('id', clip.id);
  if (error) throw error;
}

export async function deleteHighlightClip(clipId: string): Promise<void> {
  const { error } = await supabase.from('highlight_clips').delete().eq('id', clipId);
  if (error) throw error;
}
