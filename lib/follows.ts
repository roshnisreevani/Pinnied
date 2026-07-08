// ⚠️ PLACEHOLDER DATA SOURCE — followers/following don't exist in the app's
// data model yet (the only social relation is the mutual `connections`
// table). This file is the single place to plug in real data once a
// `follows` table (follower_id, followed_id) exists:
//
//   1. Create the table + RLS in a new supabase/migrations/ file.
//   2. Replace the two fetch functions below with real Supabase queries
//      (join profiles for name/avatar, matching the FollowUser shape).
//   3. Delete PLACEHOLDER_FOLLOWERS / PLACEHOLDER_FOLLOWING.
//
// Nothing else needs to change — the profile screen and the follows list
// screen both consume only these exports.

export type FollowUser = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

const PLACEHOLDER_FOLLOWERS: FollowUser[] = [
  { id: 'placeholder-1', name: 'Jordan Fields', avatarUrl: null },
  { id: 'placeholder-2', name: 'Sam Otero', avatarUrl: null },
  { id: 'placeholder-3', name: 'Riley Park', avatarUrl: null },
];

const PLACEHOLDER_FOLLOWING: FollowUser[] = [
  { id: 'placeholder-4', name: 'Alex Marino', avatarUrl: null },
  { id: 'placeholder-5', name: 'Casey Bright', avatarUrl: null },
];

export async function fetchFollowers(_userId: string): Promise<FollowUser[]> {
  return PLACEHOLDER_FOLLOWERS;
}

export async function fetchFollowing(_userId: string): Promise<FollowUser[]> {
  return PLACEHOLDER_FOLLOWING;
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([fetchFollowers(userId), fetchFollowing(userId)]);
  return { followers: followers.length, following: following.length };
}
