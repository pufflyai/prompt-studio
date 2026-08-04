import { describe, expect, test } from "bun:test";
import { loadAutomationEnabled, saveAutomationEnabled } from "./automation-settings-state";

describe("loadAutomationEnabled", () => {
  test("clears loading and surfaces a rejected settings read", async () => {
    const events: string[] = [];
    let loading = true;

    const result = await loadAutomationEnabled({
      load: async () => {
        throw new Error("settings unavailable");
      },
      setEnabled: (value) => {
        events.push(`enabled:${value}`);
      },
      setLoading: (value) => {
        loading = value;
        events.push(`loading:${value}`);
      },
    });

    expect(result).toEqual({ ok: false, message: "settings unavailable" });
    expect(loading).toBe(false);
    expect(events).toEqual(["loading:false"]);
  });
});

describe("saveAutomationEnabled", () => {
  test("restores the previous value and clears saving when persistence fails", async () => {
    const events: string[] = [];
    let enabled = false;
    let saving = false;

    const result = await saveAutomationEnabled({
      checked: true,
      current: false,
      save: async () => {
        throw new Error("storage write failed");
      },
      setEnabled: (value) => {
        enabled = value;
        events.push(`enabled:${value}`);
      },
      setSaving: (value) => {
        saving = value;
        events.push(`saving:${value}`);
      },
    });

    expect(result).toEqual({ ok: false, message: "storage write failed" });
    expect(enabled).toBe(false);
    expect(saving).toBe(false);
    expect(events).toEqual(["enabled:true", "saving:true", "enabled:false", "saving:false"]);
  });

  test("keeps the new value and clears saving after a successful write", async () => {
    const events: string[] = [];
    let enabled = false;
    let saving = false;

    const result = await saveAutomationEnabled({
      checked: true,
      current: false,
      save: async () => undefined,
      setEnabled: (value) => {
        enabled = value;
        events.push(`enabled:${value}`);
      },
      setSaving: (value) => {
        saving = value;
        events.push(`saving:${value}`);
      },
    });

    expect(result).toEqual({ ok: true });
    expect(enabled).toBe(true);
    expect(saving).toBe(false);
    expect(events).toEqual(["enabled:true", "saving:true", "saving:false"]);
  });
});
