import { fetchGroupConversationId, getOrCreateDm, sendMessage } from '@/lib/banter';
import type { Post } from '@/lib/posts';

function postAsMessage(post: Post): string {
  return post.caption
    ? `📸 Shared a post: "${post.caption}" — ${post.mediaUrl}`
    : `📸 Shared a post — ${post.mediaUrl}`;
}

/**
 * "Swipe up to banter" on a Feed card: opens (or creates) the DM thread with
 * the post's author, drops the post in as a text reference (Banter messages
 * are plain text — same format used for group forwarding below), and returns
 * the conversation id so the caller can navigate to it.
 *
 * Throws rather than failing soft: getOrCreateDm's errors are the honest,
 * user-showable reasons this can fail ("You can only message people you
 * share a connection or group with.", blocked, etc.), and the swipe-up UI
 * wants to surface them verbatim.
 */
export async function sendPostToPosterDm(post: Post, senderId: string): Promise<string> {
  const conversationId = await getOrCreateDm(post.authorId);
  await sendMessage(conversationId, senderId, postAsMessage(post));
  return conversationId;
}

/**
 * Forwards a Feed post into its group's Banter thread. Reuses Banter's own
 * fetchGroupConversationId()/sendMessage() untouched — this file only calls
 * them, it doesn't add anything to lib/banter.ts or touch Banter's schema.
 *
 * Messages are plain text (Banter's messages table has no attachment
 * concept), so the post is forwarded as a short text reference: the
 * caption (if any) plus the media URL.
 *
 * Important known gap: Feed's posts.group_id currently holds *mock* group
 * ids (see lib/groups-mock.ts) since real Groups membership isn't wired
 * into Feed yet, while Banter's conversations.group_id points at real
 * `groups` table rows created by the Groups feature. Those two ids don't
 * overlap today, so fetchGroupConversationId() will almost always return
 * null for a real post right now. This function fails soft in that case
 * (returns false, doesn't throw) so the caller can be honest with the user
 * about whether the message actually landed somewhere, rather than the app
 * pretending it was delivered. Once Feed posts reference real group ids,
 * this starts working end-to-end with no changes needed here.
 */
export async function sendPostToBanter(post: Post, senderId: string): Promise<boolean> {
  try {
    const conversationId = await fetchGroupConversationId(post.groupId);
    if (!conversationId) {
      console.warn(
        `[send-to-banter] no Banter thread found for group "${post.groupId}" — likely a mock Feed group id with no matching real group yet.`
      );
      return false;
    }

    await sendMessage(conversationId, senderId, postAsMessage(post));
    return true;
  } catch (e) {
    console.warn('[send-to-banter] could not send post to Banter:', e);
    return false;
  }
}
