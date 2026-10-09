// Resolve the milestone and track preview from the same destination used by the drop action.
import type { DropTarget } from "./drag";
import type { geometry } from "./graph-geometry";

export function dropRegion(
  box: ReturnType<typeof geometry>,
  trackIds: string[],
  target: DropTarget | undefined,
  sourceTrackId: string | null | undefined,
) {
  if (!target) {
    return;
  }

  const band = box.bands.find((entry) => entry.deadlineId === target.deadlineId);
  const destination = target.trackId === undefined ? sourceTrackId : target.trackId;
  const trackId = destination === null ? "unassigned" : destination;
  const track = box.tracks[trackIds.indexOf(trackId ?? "")];
  return band ? { band, track, trackId } : undefined;
}
