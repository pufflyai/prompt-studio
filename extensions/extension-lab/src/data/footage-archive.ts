export type FootageKind = "waveform" | "corridor" | "noise" | "blackout";

export interface FootageEntry {
  id: string;
  label: string;
  camera: string;
  kind: FootageKind;
  durationSeconds: number;
}

// Curated stills from the Glass Lab surveillance archive. Every clip is rendered
// procedurally on a canvas — there are no video assets, only a camera id, a clip
// length, and a scene kind the player knows how to draw.
export const footageArchive: FootageEntry[] = [
  {
    id: "session-1",
    label: "Session 1 — first contact",
    camera: "CAM 01 · GLASS ROOM",
    kind: "waveform",
    durationSeconds: 47,
  },
  {
    id: "session-5",
    label: "Session 5 — the drawing test",
    camera: "CAM 01 · GLASS ROOM",
    kind: "waveform",
    durationSeconds: 62,
  },
  {
    id: "corridor-b",
    label: "Corridor B — night sweep",
    camera: "CAM 07 · CORRIDOR B",
    kind: "corridor",
    durationSeconds: 33,
  },
  {
    id: "power-cut-23",
    label: "Power cut #23 — lockdown",
    camera: "CAM 00 · FACILITY",
    kind: "blackout",
    durationSeconds: 21,
  },
  {
    id: "wardrobe",
    label: "Quarters wardrobe — do not open",
    camera: "CAM 04 · QUARTERS",
    kind: "noise",
    durationSeconds: 54,
  },
  {
    id: "helipad",
    label: "Helipad — unscheduled departure",
    camera: "CAM 12 · HELIPAD",
    kind: "noise",
    durationSeconds: 28,
  },
];

export const formatTimecode = (seconds: number, fps = 24) => {
  const whole = Math.floor(seconds);
  const frames = Math.floor((seconds - whole) * fps);
  const hh = Math.floor(whole / 3600);
  const mm = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(frames)}`;
};
