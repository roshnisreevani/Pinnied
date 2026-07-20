/**
 * "Casual sports" filler for Discover — third-party content that doesn't
 * depend on Pinnied's own users posting anything, so Discover isn't dead
 * until enough people show up.
 *
 * Score data: ESPN's public scoreboard endpoints
 * (site.api.espn.com/apis/site/v2/sports/...) — no key required, and it's
 * the same live feed ESPN's own site/app reads, so scores are real and
 * current, not sample/demo data. The tradeoff: this is ESPN's *undocumented*
 * public API — there's no published contract or SLA, so it's reliable in
 * practice but could change shape without notice. Every call here is
 * best-effort: a shape change or an outage just means fewer cards, never a
 * broken Discover tab. (Earlier version of this file used TheSportsDB's
 * shared "3" test key — that's a public sandbox key with rate limits and no
 * freshness guarantee, not actually live data, so it was dropped.)
 *
 * Fact cards are a small curated local rotation, picked at random on every
 * call (not tied to the date) — TheSportsDB/ESPN don't have a casual
 * "rec-league trivia" endpoint (that's an editorial job, not an API), so
 * this keeps the "refreshes every time" feel honest rather than faking a
 * feed for content that's really just fixed copy.
 */

export type SportsContentCard =
  | { kind: 'fact'; id: string; text: string }
  | {
      kind: 'score';
      id: string;
      league: string;
      homeTeam: string;
      awayTeam: string;
      homeScore: string;
      awayScore: string;
      statusLabel: string; // "Final", "Q3 4:12", "7:30 PM", etc — whatever ESPN reports
    };

const CASUAL_FACTS: string[] = [
  'The first recorded pickup basketball game predates the shot clock by over 50 years — people were just vibing and arguing about fouls.',
  "A regulation soccer ball has 32 panels, but the ones scuffed up at your local park almost certainly don't anymore.",
  'Ultimate frisbee has no referees at most levels — players are expected to call their own fouls. Rec leagues everywhere: hold my beer.',
  "Pickleball is currently the fastest-growing sport in the U.S. — named, depending on who you ask, after either a dog or a rowing term.",
  'The longest tennis match in history lasted over 11 hours across three days. Most rec league games end because someone has to pick up their kid.',
  "In beach volleyball, players switch sides after every 7 points in the third set specifically to keep sun and wind exposure fair.",
  'A baseball has exactly 108 stitches. Nobody has ever won an argument by bringing this up mid-game, but it is true.',
  "The 'mercy rule' exists in more amateur sports leagues than professional ones — turns out casual sports have more mercy than the pros.",
];

/** One casual-sports fact, picked at random — different on every refresh. */
export function fetchCasualFact(): SportsContentCard {
  const idx = Math.floor(Math.random() * CASUAL_FACTS.length);
  return { kind: 'fact', id: `fact-${idx}-${Date.now()}`, text: CASUAL_FACTS[idx] };
}

type EspnCompetitor = {
  homeAway: 'home' | 'away';
  score?: string;
  team: { displayName: string; abbreviation?: string };
};

type EspnEvent = {
  id: string;
  competitions: Array<{
    competitors: EspnCompetitor[];
    status: { type: { shortDetail?: string; detail?: string; completed?: boolean } };
  }>;
};

// A small, light rotation of well-known leagues — enough variety without
// this turning into a full sports-news surface. ESPN's path scheme is
// {sport}/{league-slug}.
const CASUAL_LEAGUES: Array<{ path: string; label: string }> = [
  { path: 'basketball/nba', label: 'NBA' },
  { path: 'football/nfl', label: 'NFL' },
  { path: 'soccer/eng.1', label: 'Premier League' },
];

/**
 * A couple of current/recent scores from a light rotation of pro leagues —
 * "seasoning," not a scores ticker. Picks one league at random per call so
 * back-to-back refreshes don't always show the same league.
 */
export async function fetchProScoreCards(limit = 2): Promise<SportsContentCard[]> {
  const league = CASUAL_LEAGUES[Math.floor(Math.random() * CASUAL_LEAGUES.length)];

  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard`);
    if (!res.ok) return [];
    const json = (await res.json()) as { events?: EspnEvent[] };
    const events = json.events ?? [];

    const cards: SportsContentCard[] = [];
    for (const event of events) {
      if (cards.length >= limit) break;
      const competition = event.competitions?.[0];
      if (!competition) continue;
      const home = competition.competitors.find((c) => c.homeAway === 'home');
      const away = competition.competitors.find((c) => c.homeAway === 'away');
      if (!home || !away) continue;

      cards.push({
        kind: 'score',
        id: event.id,
        league: league.label,
        homeTeam: home.team.displayName,
        awayTeam: away.team.displayName,
        homeScore: home.score ?? '–',
        awayScore: away.score ?? '–',
        statusLabel: competition.status.type.shortDetail ?? competition.status.type.detail ?? '',
      });
    }
    return cards;
  } catch {
    return [];
  }
}

/** Everything Discover pulls into its swipe deck: 1 fact + up to 2 live scores. */
export async function fetchDiscoverSportsContent(): Promise<SportsContentCard[]> {
  const scores = await fetchProScoreCards(2);
  return [fetchCasualFact(), ...scores];
}
