import { fetchGroupConversationId, sendMessage } from '@/lib/banter';
import type { Post } from '@/lib/posts';

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

    const content = post.caption
      ? `📸 Shared a post: "${post.caption}" — ${post.mediaUrl}`
      : `📸 Shared a post — ${post.mediaUrl}`;
    await sendMessage(conversationId, senderId, content);
    return true;
  } catch (e) {
    console.warn('[send-to-banter] could not send post to Banter:', e);
    return false;
  }
}
