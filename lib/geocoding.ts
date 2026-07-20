// Free place search — no API key, no billing account, unlike Google Places.
// Uses OpenStreetMap's public Nominatim search endpoint, same free-tile
// philosophy as components/open-games/game-map.tsx. Nominatim's usage policy
// (https://operations.osmfoundation.org/policies/nominatim/) asks for an
// identifying User-Agent and roughly 1 request/sec max — fine for a
// low-volume friend-group app; if this app's search volume ever grows past
// what's reasonable for the shared public instance, self-hosting Nominatim
// or switching to a paid provider is the upgrade path, not something to
// worry about now.

export type PlaceResult = {
  name: string;
  latitude: number;
  longitude: number;
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(trimmed)}`;

  const res = await fetch(url, {
    headers: {
      // Nominatim's usage policy asks for an identifying User-Agent on every
      // request rather than anonymous traffic.
      'User-Agent': 'Pinnied (github.com/group4/the-rec)',
    },
  });
  if (!res.ok) throw new Error('Could not search for that place.');

  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((row) => ({
    name: row.display_name,
    latitude: parseFloat(row.lat),
    longitude: parseFloat(row.lon),
  }));
}
