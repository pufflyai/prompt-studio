import { defineMode, definePage, defineView } from "./define-contribution";
import type { GuestHost } from "./define-extension-view";

defineView({
  id: "invalid-controls",
  title: "Controls",
  body: {
    kind: "controls",
    // @ts-expect-error Number controls require a numeric default value.
    query: () => ({ params: [{ id: "count", name: "Count", type: "number", defaultValue: "two" }] }),
  },
});

definePage({
  id: "typo",
  title: "Typo",
  path: "typo",
  mode: { kind: "mode", id: "review" },
  main: { kind: "panels", empty: { kind: "view", id: "empty" } },
  slots: [
    {
      id: "inspector",
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "inspector" }, presence: "open" },
      // @ts-expect-error The supported option is mountStrategy.
      mountStrategyy: "keep-alive",
    },
  ],
});

defineMode({
  id: "typo-mode",
  label: "Review",
  regions: ["main"],
  // @ts-expect-error Chrome region names must match the declared contract.
  chrome: { sidenav: false, sidenavv: false },
});

declare const host: GuestHost;
// @ts-expect-error Navigation requires a typed target, not a path string.
host.call("navigation.open", { target: "/notes" });
// @ts-expect-error Unknown host capabilities are not part of the bridge contract.
host.call("navigation.teleport", {});
// @ts-expect-error Callers cannot choose a host capability's result type.
host.call<number>("preferences.get", { name: "count" });

import type { ControlValue, JsonValue } from "./index";
import { eventRef } from "./index";

const changed = eventRef<{ id: string }>({ extensionId: "acme.notes", id: "notes.changed" });
defineView({
  id: "typed-events",
  title: "Notes",
  body: { kind: "file", refreshEvents: [changed], load: () => ({ content: "" }) },
});
export const serializableControlValue = (value: ControlValue): JsonValue => value;
