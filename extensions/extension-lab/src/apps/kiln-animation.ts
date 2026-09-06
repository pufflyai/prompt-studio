export const kilnFrameCount = 120;
export const kilnFrameRate = 24;

interface KilnKeyframe {
  frame: number;
  value: number;
}

export const kilnTracks = [
  {
    objectId: "cube",
    label: "Rotation Z",
    property: "rotation",
    keys: [
      { frame: 1, value: 0 },
      { frame: 30, value: 90 },
      { frame: 60, value: 180 },
      { frame: 90, value: 270 },
      { frame: 120, value: 360 },
    ],
  },
  {
    objectId: "sphere",
    label: "Position Z",
    property: "position",
    keys: [
      { frame: 1, value: 0 },
      { frame: 30, value: 0.9 },
      { frame: 60, value: 0 },
      { frame: 90, value: 0.9 },
      { frame: 120, value: 0 },
    ],
  },
] as const;

export const sampleKilnTrack = (keys: readonly KilnKeyframe[], frame: number) => {
  const nextIndex = keys.findIndex((key) => key.frame > frame);
  if (nextIndex === 0) return keys[0].value;
  if (nextIndex === -1) return keys[keys.length - 1].value;
  const previous = keys[nextIndex - 1];
  const next = keys[nextIndex];
  const progress = (frame - previous.frame) / (next.frame - previous.frame);
  const eased = progress * progress * (3 - 2 * progress);
  return previous.value + (next.value - previous.value) * eased;
};
