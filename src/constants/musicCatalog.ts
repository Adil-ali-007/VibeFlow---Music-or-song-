export interface GenreDefinition {
  id: string;
  label: string;
  query: string;
  mixTitle: string;
  subtitle: string;
  gradient: string;
  accentColor: string;
}

export const ONBOARDING_GENRES: GenreDefinition[] = [
  {
    id: 'lofi',
    label: 'Lo-fi',
    query: 'lofi chill beats study',
    mixTitle: 'Your Lo-fi Mix',
    subtitle: 'Chill beats & late-night instrumentals',
    gradient: 'from-indigo-600 via-purple-700 to-slate-900',
    accentColor: '#818cf8',
  },
  {
    id: 'pop',
    label: 'Pop',
    query: 'pop hits chart songs',
    mixTitle: 'Pop Essentials',
    subtitle: 'hooks, anthems & modern hits',
    gradient: 'from-pink-600 via-rose-600 to-slate-900',
    accentColor: '#f472b6',
  },
  {
    id: 'hip-hop',
    label: 'Hip-Hop',
    query: 'hip hop rap essentials',
    mixTitle: 'Hip-Hop Rotation',
    subtitle: 'Beats, bars & rhythm',
    gradient: 'from-amber-600 via-orange-700 to-slate-900',
    accentColor: '#fbbf24',
  },
  {
    id: 'rnb',
    label: 'R&B',
    query: 'r&b soul smooth hits',
    mixTitle: 'R&B & Soul Vibes',
    subtitle: 'Smooth vocals & late-night grooves',
    gradient: 'from-fuchsia-700 via-purple-800 to-slate-900',
    accentColor: '#e879f9',
  },
  {
    id: 'rock',
    label: 'Rock',
    query: 'rock classics modern rock anthems',
    mixTitle: 'Rock Anthems',
    subtitle: 'Guitars, drums & timeless energy',
    gradient: 'from-red-700 via-rose-800 to-slate-900',
    accentColor: '#f87171',
  },
  {
    id: 'indie',
    label: 'Indie',
    query: 'indie alternative essentials',
    mixTitle: 'Indie Favorites',
    subtitle: 'Alternative sounds & fresh voices',
    gradient: 'from-emerald-600 via-teal-700 to-slate-900',
    accentColor: '#34d399',
  },
  {
    id: 'electronic',
    label: 'Electronic',
    query: 'electronic synth house music',
    mixTitle: 'Electronic Pulse',
    subtitle: 'Synths, club grooves & bass',
    gradient: 'from-cyan-600 via-blue-700 to-slate-900',
    accentColor: '#22d3ee',
  },
  {
    id: 'classical',
    label: 'Classical',
    query: 'classical piano orchestral masterpieces',
    mixTitle: 'Classical Masterworks',
    subtitle: 'Timeless piano & orchestral pieces',
    gradient: 'from-amber-700 via-yellow-800 to-slate-900',
    accentColor: '#fcd34d',
  },
  {
    id: 'jazz',
    label: 'Jazz',
    query: 'jazz instrumental smooth saxophone',
    mixTitle: 'Jazz Lounge',
    subtitle: 'Warm brass, piano trios & swing',
    gradient: 'from-orange-700 via-amber-800 to-slate-900',
    accentColor: '#fb923c',
  },
  {
    id: 'hindi',
    label: 'Hindi',
    query: 'hindi top songs hits',
    mixTitle: 'Hindi Hits',
    subtitle: 'Chart-topping Hindi favorites',
    gradient: 'from-rose-600 via-red-700 to-slate-900',
    accentColor: '#fb7185',
  },
  {
    id: 'bollywood',
    label: 'Bollywood',
    query: 'bollywood hits songs',
    mixTitle: 'Bollywood Blockbusters',
    subtitle: 'Iconic soundtracks & new releases',
    gradient: 'from-orange-600 via-rose-700 to-slate-900',
    accentColor: '#f97316',
  },
  {
    id: 'punjabi',
    label: 'Punjabi',
    query: 'punjabi hits songs ap dhillon diljit',
    mixTitle: 'Punjabi Vibes',
    subtitle: 'High-energy Punjabi beats & anthems',
    gradient: 'from-yellow-600 via-amber-700 to-slate-900',
    accentColor: '#facc15',
  },
  {
    id: 'romantic',
    label: 'Romantic',
    query: 'romantic love songs acoustic ballads',
    mixTitle: 'Romantic Melodies',
    subtitle: 'Love songs & heartfelt ballads',
    gradient: 'from-pink-700 via-rose-800 to-slate-900',
    accentColor: '#f43f5e',
  },
  {
    id: 'sad-songs',
    label: 'Sad Songs',
    query: 'sad emotional heartbreak songs',
    mixTitle: 'Late Night Feels',
    subtitle: 'Emotional vocals & rainy-day tracks',
    gradient: 'from-slate-700 via-blue-900 to-slate-950',
    accentColor: '#60a5fa',
  },
  {
    id: 'workout',
    label: 'Workout',
    query: 'workout gym motivation high energy music',
    mixTitle: 'Workout Boost',
    subtitle: 'High-tempo tracks to power your set',
    gradient: 'from-lime-600 via-emerald-700 to-slate-900',
    accentColor: '#a3e635',
  },
  {
    id: 'chill',
    label: 'Chill',
    query: 'chill acoustic ambient vibes',
    mixTitle: 'Chill Vibes',
    subtitle: 'Unwind with easygoing sounds',
    gradient: 'from-teal-600 via-cyan-800 to-slate-900',
    accentColor: '#2dd4bf',
  },
  {
    id: 'party',
    label: 'Party',
    query: 'party dance hits upbeat anthems',
    mixTitle: 'Party Starters',
    subtitle: 'Upbeat dancefloor & weekend hits',
    gradient: 'from-violet-600 via-fuchsia-700 to-slate-900',
    accentColor: '#c084fc',
  },
  {
    id: 'focus',
    label: 'Focus',
    query: 'deep focus study instrumental ambient',
    mixTitle: 'Deep Focus',
    subtitle: 'Distraction-free instrumentals for work',
    gradient: 'from-sky-600 via-indigo-800 to-slate-900',
    accentColor: '#38bdf8',
  },
];

export const BROWSE_CATEGORIES: GenreDefinition[] = [
  ONBOARDING_GENRES.find((g) => g.id === 'lofi')!,
  {
    id: 'english',
    label: 'English',
    query: 'english pop hits global songs',
    mixTitle: 'English Hits',
    subtitle: 'Global chart-toppers & essentials',
    gradient: 'from-blue-600 via-indigo-700 to-slate-900',
    accentColor: '#60a5fa',
  },
  ONBOARDING_GENRES.find((g) => g.id === 'hindi')!,
  ONBOARDING_GENRES.find((g) => g.id === 'punjabi')!,
  ONBOARDING_GENRES.find((g) => g.id === 'bollywood')!,
  ONBOARDING_GENRES.find((g) => g.id === 'indie')!,
  ONBOARDING_GENRES.find((g) => g.id === 'pop')!,
  ONBOARDING_GENRES.find((g) => g.id === 'hip-hop')!,
  ONBOARDING_GENRES.find((g) => g.id === 'classical')!,
  ONBOARDING_GENRES.find((g) => g.id === 'romantic')!,
  ONBOARDING_GENRES.find((g) => g.id === 'sad-songs')!,
  ONBOARDING_GENRES.find((g) => g.id === 'chill')!,
  ONBOARDING_GENRES.find((g) => g.id === 'workout')!,
  ONBOARDING_GENRES.find((g) => g.id === 'party')!,
  ONBOARDING_GENRES.find((g) => g.id === 'focus')!,
  {
    id: 'trending',
    label: 'Trending',
    query: 'trending music hits popular songs',
    mixTitle: 'Trending Now',
    subtitle: 'Most popular tracks right now',
    gradient: 'from-emerald-500 via-teal-700 to-slate-900',
    accentColor: '#10b981',
  },
];

export const ALL_GENRE_MAP: Record<string, GenreDefinition> = Object.fromEntries(
  [...ONBOARDING_GENRES, ...BROWSE_CATEGORIES].map((g) => [g.id, g])
);

export function getGenreDefinition(id: string): GenreDefinition {
  const normalized = id.trim().toLowerCase();
  if (ALL_GENRE_MAP[normalized]) {
    return ALL_GENRE_MAP[normalized];
  }
  const byLabel = [...ONBOARDING_GENRES, ...BROWSE_CATEGORIES].find(
    (g) => g.label.toLowerCase() === normalized
  );
  if (byLabel) {
    return byLabel;
  }
  return {
    id: normalized,
    label: id,
    query: `${id} music hits`,
    mixTitle: `${id} Mix`,
    subtitle: `Recommended ${id} tracks`,
    gradient: 'from-emerald-600 via-teal-800 to-slate-900',
    accentColor: '#10b981',
  };
}
