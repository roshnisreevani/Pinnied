import { fetchBlockedUserIds } from '@/lib/moderation';
import { supabase } from '@/lib/supabase';

export type SkillLevel = 'all' | 'beginner' | 'competitive';

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  all: 'All Levels',
  beginner: 'Beginner Friendly',
  competitive: 'Competitive',
};

export type GameStatus = 'upcoming' | 'live' | 'completed';

export type OpenGame = {
  id: string;
  createdBy: string;
  sport: string;
  title: string;
  description: string;
  skillLevel: SkillLevel;
  locationName: string;
  latitude: number;
  longitude: number;
  startsAt: string;
  maxSpots: number | null;
  requiresApproval: boolean;
  photosPublic: boolean;
  distanceMiles: number;
  goingCount: number;
  photoCount: number;
  gameStatus: GameStatus;
  isCancelled: boolean;
};

export type OpenGameParticipant = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  introMessage: string | null;
};

export type MyRsvpStatus = 'going' | 'waitlisted' | 'pending' | 'none';

export const MAX_GAME_PHOTOS = 30;

export const STATUS_CHIPS: Array<{ value: string; label: string }> = [
  { value: 'on_way', label: '🏃 On my way' },
  { value: 'running_late', label: '⏰ Running late' },
  { value: 'cant_make_it', label: "❌ Can't make it" },
  { value: 'bringing_gear', label: '🎒 Bringing gear' },
];

type DiscoverGameRow = {
  id: string;
  created_by: string;
  sport: string;
  title: string;
  description: string;
  skill_level: SkillLevel;
  location_name: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  max_spots: number | null;
  requires_approval: boolean;
  photos_public: boolean;
  distance_miles: number;
  going_count: number;
  photo_count: number;
  game_status: GameStatus;
};

/** Browse open games near you — upcoming, currently live, and recently completed ones with public photos. */
export async function discoverOpenGames(lat: number, lng: number, radiusMiles = 25): Promise<OpenGame[]> {
  const { data, error } = await supabase.rpc('discover_open_games', {
    p_lat: lat,
    p_lng: lng,
    p_radius_miles: radiusMiles,
  });
  if (error) throw error;

  return ((data ?? []) as DiscoverGameRow[]).map((row) => ({
    id: row.id,
    createdBy: row.created_by,
    sport: row.sport,
    title: row.title,
    description: row.description ?? '',
    skillLevel: row.skill_level,
    locationName: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    startsAt: row.starts_at,
    maxSpots: row.max_spots,
    requiresApproval: row.requires_approval,
    photosPublic: row.photos_public,
    distanceMiles: row.distance_miles,
    goingCount: row.going_count,
    photoCount: row.photo_count,
    gameStatus: row.game_status,
    // discover_open_games only ever returns active games, so this is always
    // false here — cancelled games simply never surface in Discover.
    isCancelled: false,
  }));
}

function computeGameStatus(startsAtIso: string): GameStatus {
  const startsAt = new Date(startsAtIso).getTime();
  const now = Date.now();
  if (startsAt > now) return 'upcoming';
  if (now < startsAt + 4 * 60 * 60 * 1000) return 'live';
  return 'completed';
}

/** A single game's detail, independent of distance (used by the game detail screen). */
export async function fetchOpenGame(gameId: string): Promise<OpenGame | null> {
  const { data, error } = await supabase.from('open_games').select('*').eq('id', gameId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    created_by: string;
    sport: string;
    title: string;
    description: string;
    skill_level: SkillLevel;
    location_name: string;
    latitude: number;
    longitude: number;
    starts_at: string;
    max_spots: number | null;
    requires_approval: boolean;
    photos_public: boolean;
    status: string;
  };

  const [{ count: goingCount }, { count: photoCount }] = await Promise.all([
    supabase
      .from('open_game_rsvps')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', gameId)
      .eq('status', 'going'),
    supabase.from('game_photos').select('id', { count: 'exact', head: true }).eq('game_id', gameId),
  ]);

  return {
    id: row.id,
    createdBy: row.created_by,
    sport: row.sport,
    title: row.title,
    description: row.description ?? '',
    skillLevel: row.skill_level,
    locationName: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    startsAt: row.starts_at,
    maxSpots: row.max_spots,
    requiresApproval: row.requires_approval,
    photosPublic: row.photos_public,
    distanceMiles: 0,
    goingCount: goingCount ?? 0,
    photoCount: photoCount ?? 0,
    gameStatus: computeGameStatus(row.starts_at),
    isCancelled: row.status === 'cancelled',
  };
}

export async function createOpenGame(input: {
  createdBy: string;
  sport: string;
  title: string;
  description: string;
  skillLevel: SkillLevel;
  locationName: string;
  latitude: number;
  longitude: number;
  startsAt: string;
  maxSpots: number | null;
  requiresApproval: boolean;
  photosPublic: boolean;
}): Promise<string> {
  const { data, error } = await supabase
    .from('open_games')
    .insert({
      created_by: input.createdBy,
      sport: input.sport,
      title: input.title,
      description: input.description,
      skill_level: input.skillLevel,
      location_name: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
      starts_at: input.startsAt,
      max_spots: input.maxSpots,
      requires_approval: input.requiresApproval,
      photos_public: input.photosPublic,
    })
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

export async function cancelOpenGame(gameId: string): Promise<void> {
  const { error } = await supabase.from('open_games').update({ status: 'cancelled' }).eq('id', gameId);
  if (error) throw error;
}

/** Organizer-only edit — any field an organizer might reasonably want to change after posting. */
export async function updateOpenGame(
  gameId: string,
  input: Partial<{
    sport: string;
    title: string;
    description: string;
    skillLevel: SkillLevel;
    locationName: string;
    latitude: number;
    longitude: number;
    startsAt: string;
    maxSpots: number | null;
    requiresApproval: boolean;
    photosPublic: boolean;
  }>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.sport !== undefined) patch.sport = input.sport;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.skillLevel !== undefined) patch.skill_level = input.skillLevel;
  if (input.locationName !== undefined) patch.location_name = input.locationName;
  if (input.latitude !== undefined) patch.latitude = input.latitude;
  if (input.longitude !== undefined) patch.longitude = input.longitude;
  if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
  if (input.maxSpots !== undefined) patch.max_spots = input.maxSpots;
  if (input.requiresApproval !== undefined) patch.requires_approval = input.requiresApproval;
  if (input.photosPublic !== undefined) patch.photos_public = input.photosPublic;

  const { error } = await supabase.from('open_games').update(patch).eq('id', gameId);
  if (error) throw error;
}

/** Everyone actually confirmed ("going"), roster-card order (earliest join first). */
export async function fetchGameParticipants(gameId: string): Promise<OpenGameParticipant[]> {
  return fetchRosterByStatus(gameId, 'going');
}

/** Everyone waiting on a spot, in the order they'll be promoted (earliest first). */
export async function fetchGameWaitlist(gameId: string): Promise<OpenGameParticipant[]> {
  return fetchRosterByStatus(gameId, 'waitlisted');
}

/** Organizer-only: everyone waiting on approval, oldest request first. */
export async function fetchPendingRequests(gameId: string): Promise<OpenGameParticipant[]> {
  return fetchRosterByStatus(gameId, 'pending');
}

async function fetchRosterByStatus(
  gameId: string,
  status: 'going' | 'waitlisted' | 'pending'
): Promise<OpenGameParticipant[]> {
  const { data, error } = await supabase
    .from('open_game_rsvps')
    .select('user_id, created_at, intro_message, profiles!open_game_rsvps_user_id_fkey(name, avatar_url)')
    .eq('game_id', gameId)
    .eq('status', status)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as Array<{
    user_id: string;
    created_at: string;
    intro_message: string | null;
    profiles: { name: string | null; avatar_url: string | null } | null;
  }>).map((row) => ({
    userId: row.user_id,
    name: row.profiles?.name?.trim() || 'Nameless legend',
    avatarUrl: row.profiles?.avatar_url ?? null,
    joinedAt: row.created_at,
    introMessage: row.intro_message,
  }));
}

export async function fetchMyRsvpStatus(gameId: string, userId: string): Promise<MyRsvpStatus> {
  const { data, error } = await supabase
    .from('open_game_rsvps')
    .select('status')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const status = (data as { status?: string } | null)?.status;
  return status === 'going' || status === 'waitlisted' || status === 'pending' ? status : 'none';
}

/**
 * Joins the game (or joins its waitlist, or — if the organizer requires
 * approval — files a join request) in one server-side call, so capacity
 * checks can't race. `introMessage` is the short note shown to the
 * organizer on approval-required games; ignored otherwise.
 */
export async function joinOpenGame(gameId: string, introMessage?: string): Promise<MyRsvpStatus> {
  const { data, error } = await supabase.rpc('join_open_game', {
    p_game_id: gameId,
    p_intro_message: introMessage?.trim() || null,
  });
  if (error) throw error;
  return data as MyRsvpStatus;
}

/** Leaving a confirmed spot automatically promotes the next person off the waitlist (handled server-side). */
export async function leaveOpenGame(gameId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_open_game', { p_game_id: gameId });
  if (error) throw error;
}

/** Organizer-only: remove someone from their game's roster, optionally with a report reason. */
export async function removeParticipant(gameId: string, userId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('remove_open_game_rsvp', {
    p_game_id: gameId,
    p_user_id: userId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

/** Organizer-only: approve or decline a pending join request. */
export async function respondToJoinRequest(gameId: string, userId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_join_request', {
    p_game_id: gameId,
    p_user_id: userId,
    p_approve: approve,
  });
  if (error) throw error;
}

// ---- Game Day Thread ----

export type GameThreadPost = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  kind: 'status' | 'text' | 'checkin';
  statusChip: string | null;
  body: string | null;
  createdAt: string;
};

export async function fetchGameThread(gameId: string, currentUserId?: string): Promise<GameThreadPost[]> {
  const [{ data, error }, blockedIds] = await Promise.all([
    supabase
      .from('game_thread_posts')
      .select('id, user_id, kind, status_chip, body, created_at, profiles!game_thread_posts_user_id_fkey(name, avatar_url)')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true }),
    fetchBlockedUserIds(currentUserId),
  ]);

  if (error) throw error;

  const blocked = new Set(blockedIds);

  return ((data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    kind: 'status' | 'text' | 'checkin';
    status_chip: string | null;
    body: string | null;
    created_at: string;
    profiles: { name: string | null; avatar_url: string | null } | null;
  }>)
    .filter((row) => !blocked.has(row.user_id))
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.profiles?.name?.trim() || 'Nameless legend',
      avatarUrl: row.profiles?.avatar_url ?? null,
      kind: row.kind,
      statusChip: row.status_chip,
      body: row.body,
      createdAt: row.created_at,
    }));
}

export async function postThreadStatus(gameId: string, userId: string, statusChip: string): Promise<void> {
  const { error } = await supabase
    .from('game_thread_posts')
    .insert({ game_id: gameId, user_id: userId, kind: 'status', status_chip: statusChip });
  if (error) throw error;
}

export async function postThreadMessage(gameId: string, userId: string, body: string): Promise<void> {
  const { error } = await supabase.from('game_thread_posts').insert({ game_id: gameId, user_id: userId, kind: 'text', body });
  if (error) throw error;
}

/** One check-in per person per game (enforced by a unique index) — silently no-ops if already checked in. */
export async function checkInToGame(gameId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('game_thread_posts').insert({ game_id: gameId, user_id: userId, kind: 'checkin' });
  // Postgres error 23505 = unique_violation — expected/harmless here since
  // it just means this person already checked in.
  if (error && error.code !== '23505') throw error;
}

export async function fetchCheckedInCount(gameId: string): Promise<number> {
  const { count, error } = await supabase
    .from('game_thread_posts')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('kind', 'checkin');
  if (error) throw error;
  return count ?? 0;
}

/**
 * Who actually checked in vs. who was on the roster — organizer-only signal
 * surfaced as a lightweight "no-show" tag on the roster (not a cross-game
 * reputation system; that's a bigger product decision than a check-in count
 * alone can fairly support).
 */
export async function fetchCheckedInUserIds(gameId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('game_thread_posts')
    .select('user_id')
    .eq('game_id', gameId)
    .eq('kind', 'checkin');
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.user_id as string));
}

export async function fetchIAmCheckedIn(gameId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('game_thread_posts')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .eq('kind', 'checkin')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// ---- Photo Recap ----

export type GamePhoto = {
  id: string;
  userId: string;
  photoUrl: string;
  createdAt: string;
};

export async function fetchGamePhotos(gameId: string, currentUserId?: string): Promise<GamePhoto[]> {
  const [{ data, error }, blockedIds] = await Promise.all([
    supabase
      .from('game_photos')
      .select('id, user_id, photo_url, created_at')
      .eq('game_id', gameId)
      .order('created_at', { ascending: false }),
    fetchBlockedUserIds(currentUserId),
  ]);

  if (error) throw error;

  const blocked = new Set(blockedIds);

  return ((data ?? []) as unknown as Array<{
    id: string;
    user_id: string;
    photo_url: string;
    created_at: string;
  }>)
    .filter((row) => !blocked.has(row.user_id))
    .map((row) => ({ id: row.id, userId: row.user_id, photoUrl: row.photo_url, createdAt: row.created_at }));
}

export async function addGamePhoto(gameId: string, userId: string, photoUrl: string): Promise<void> {
  const { error } = await supabase.from('game_photos').insert({ game_id: gameId, user_id: userId, photo_url: photoUrl });
  if (error) throw error;
}

export async function deleteGamePhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('game_photos').delete().eq('id', photoId);
  if (error) throw error;
}
