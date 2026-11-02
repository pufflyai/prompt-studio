import { expect, test } from "bun:test";
import { editKeyframe, sampleTrack, selectedKeyframe, snapTime } from "./keyframe-model";

const track = {
  id: "opacity",
  label: "Opacity",
  keyframes: [
    { id: "a", time: 0, value: 0 },
    { id: "b", time: 1, value: 1 },
  ],
};
test("time edits snap to frames and stay inside the duration", () => {
  expect(snapTime(0.123, 2, 25)).toBe(0.12);
  expect(snapTime(-1, 2, 25)).toBe(0);
  expect(snapTime(3, 2, 25)).toBe(2);
  expect(editKeyframe(track, "b", { time: 0.123 }, 2, 25).keyframes[1].time).toBe(0.12);
});
test("moving onto an occupied frame preserves both authored keys", () => {
  expect(editKeyframe(track, "b", { time: 0 }, 2, 25)).toEqual(track);
  expect(editKeyframe(track, "a", { value: 0.25 }, 2, 25).keyframes[0].value).toBe(0.25);
});
test("new keys sample the track with linear and held interpolation", () => {
  expect(sampleTrack(track, 0.5)).toBe(0.5);
  expect(
    sampleTrack({ ...track, keyframes: [{ ...track.keyframes[0], easing: "hold" }, track.keyframes[1]] }, 0.5),
  ).toBe(0);
  expect(sampleTrack(track, 3)).toBe(1);
});

test("value and interpolation edits preserve authored subframe times", () => {
  const authored = { ...track, keyframes: [{ id: "subframe", time: 0.25, value: 4 }] };
  expect(editKeyframe(authored, "subframe", { value: 5 }, 2, 25).keyframes[0].time).toBe(0.25);
  expect(editKeyframe(authored, "subframe", { easing: "hold" }, 2, 25).keyframes[0].time).toBe(0.25);
});

test("a removed track selection never resolves a reused key ID in another track", () => {
  expect(selectedKeyframe([track], { trackId: "removed", keyframeId: "a" })).toBeUndefined();
  expect(selectedKeyframe([track], { trackId: track.id, keyframeId: "a" })?.keyframe.value).toBe(0);
});

test("editing values preserves authored neighbours that share a display frame", () => {
  const authored = {
    ...track,
    keyframes: [
      { id: "a", time: 0.1, value: 1 },
      { id: "b", time: 0.11, value: 2 },
    ],
  };
  expect(editKeyframe(authored, "a", { value: 3 }, 2, 25).keyframes[0]).toEqual({ id: "a", time: 0.1, value: 3 });
});
