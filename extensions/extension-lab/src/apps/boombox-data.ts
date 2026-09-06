export interface BoomboxTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  tint: string;
}

export const boomboxTracks: readonly BoomboxTrack[] = [
  {
    id: "soft-focus",
    title: "Soft Focus",
    artist: "Low Island",
    album: "Sunday Static",
    duration: "3:42",
    tint: "teal",
  },
  {
    id: "paper-moon",
    title: "Paper Moon",
    artist: "Mira Vale",
    album: "Sunday Static",
    duration: "4:08",
    tint: "purple",
  },
  {
    id: "afterimage",
    title: "Afterimage",
    artist: "Hollow Coast",
    album: "Night Transit",
    duration: "3:17",
    tint: "orange",
  },
  {
    id: "still-life",
    title: "Still Life",
    artist: "North Arcade",
    album: "Night Transit",
    duration: "5:01",
    tint: "blue",
  },
  {
    id: "golden-hour",
    title: "Golden Hour",
    artist: "Mira Vale",
    album: "Sunday Static",
    duration: "3:36",
    tint: "pink",
  },
];
