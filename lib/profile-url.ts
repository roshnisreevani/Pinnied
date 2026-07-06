// Placeholder profile URL format used for the QR share card. Replace once
// there's a real web presence for The Rec, or in-app deep linking is wired up
// via expo-linking (scheme is already registered as "therec" in app.json).
export function getProfileShareUrl(userId: string): string {
  return `https://therec.app/u/${userId}`;
}
