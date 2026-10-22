import type { HostStorage } from "@pstdio/ui";
import { createContext, type ReactNode, useContext, useState } from "react";
import type { MilestoneDisplay } from "../model/milestone-visibility";

interface TimelinePresentation extends MilestoneDisplay {
  collapsedTracks: string[];
  collapsedMilestones: string[];
}

const initial: TimelinePresentation = { collapsedTracks: [], collapsedMilestones: [] };
const read = (storage: HostStorage | undefined, key: string) => {
  const value = storage?.getItem(key);
  const saved: Partial<TimelinePresentation> = value ? JSON.parse(value) : {};
  return { ...initial, ...saved };
};
const PresentationContext = createContext({
  value: initial,
  update: (_value: Partial<TimelinePresentation>) => {},
  toggle: (_kind: "collapsedTracks" | "collapsedMilestones", _id: string) => {},
});

export function TimelinePresentationProvider(props: { projectId: string; storage?: HostStorage; children: ReactNode }) {
  const { projectId, storage, children } = props;
  const key = `pstdio.pstdio-planner.timeline-presentation:${projectId}`;
  const [value, setValue] = useState(() => read(storage, key));
  const update = (changes: Partial<TimelinePresentation>) => {
    const next = { ...value, ...changes };
    setValue(next);
    storage?.setItem(key, JSON.stringify(next));
  };
  const toggle = (kind: "collapsedTracks" | "collapsedMilestones", id: string) => {
    const ids = value[kind];
    update({ [kind]: ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id] });
  };
  return <PresentationContext value={{ value, update, toggle }}>{children}</PresentationContext>;
}

export const useTimelinePresentation = () => useContext(PresentationContext);
