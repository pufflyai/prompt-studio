// Read the saved display settings, apply changes at once, and save them for the next visit.
import { useState } from "react";
import { type DisplaySettings, displayChanged } from "../contracts";
import { defaultDisplay } from "../model/display";
import { useLiveValue } from "./use-live-value";
import type { PlanClient } from "./use-plan";

const readDisplay = (client: PlanClient) => client.commands["display.read"]();

const displayEvents = [displayChanged];

export function useDisplay(client: PlanClient) {
  const { value, setValue, error } = useLiveValue(client, readDisplay, displayEvents);
  const [saveError, setSaveError] = useState<string>();
  const display = value ?? defaultDisplay;
  const update = (change: Partial<DisplaySettings>) => {
    const next = { ...display, ...change };
    setValue(next);
    setSaveError(undefined);
    client.commands["display.save"]({ display: next }).catch((reason) => setSaveError(String(reason)));
  };

  return { display, update, error: error ?? saveError };
}
