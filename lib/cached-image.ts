import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

const cacheDir = new Directory(Paths.cache, 'avatar-cache');

function ensureCacheDir(): void {
  if (!cacheDir.exists) {
    cacheDir.create({ intermediates: true });
  }
}

function extensionFor(uri: string): string {
  const match = uri.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

// Plain FNV-1a hash — just needs to turn a URL into a short, filesystem-safe,
// collision-resistant-enough filename. No cryptographic strength needed
// here, so this avoids pulling in expo-crypto as a new dependency.
function hashUri(uri: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < uri.length; i++) {
    hash ^= uri.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Downloads a remote image to local disk once and reuses that copy on every
 * subsequent render/mount, instead of re-fetching over the network each
 * time. Written for CrestAvatar specifically — react-native-svg's <Image>
 * has no HTTP cache of its own (unlike expo-image), so every crest render
 * was re-downloading the full photo from Supabase Storage. That's the
 * direct cause of blowing past the free-tier cached-egress quota with only
 * 9 monthly active users and 35MB of actual stored photos.
 *
 * Returns the original remote URI until the local copy is ready (so the
 * first render still shows something), then swaps to the cached file URI.
 */
export function useCachedUri(remoteUri: string | null): string | null {
  const [cachedUri, setCachedUri] = useState<string | null>(remoteUri);

  useEffect(() => {
    let cancelled = false;
    setCachedUri(remoteUri);

    if (!remoteUri || !remoteUri.startsWith('http')) return;

    (async () => {
      try {
        ensureCacheDir();
        const localFile = new File(cacheDir, `${hashUri(remoteUri)}.${extensionFor(remoteUri)}`);

        if (!localFile.exists) {
          await File.downloadFileAsync(remoteUri, localFile, { idempotent: true });
        }

        if (!cancelled && localFile.exists) setCachedUri(localFile.uri);
      } catch {
        // Fall back silently to the remote URI — a cache-miss shouldn't
        // ever break rendering the actual photo.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [remoteUri]);

  return cachedUri;
}
