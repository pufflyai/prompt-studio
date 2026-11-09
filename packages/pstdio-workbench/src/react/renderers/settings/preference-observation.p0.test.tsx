import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createPreferenceRegistry } from "../../../core/registries/preferences/preference-registry";
import { createLocalStoragePreferencePersistence } from "../../../storage/local-storage-preference-persistence";
import { usePreferenceEntries } from "./use-preference-entries";

test("preference forms observe only their selected values and scope, then release observation", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
  const preferences = createPreferenceRegistry({
    persistence: createLocalStoragePreferencePersistence(storage, "preferences"),
  });
  const writer = createLocalStoragePreferencePersistence(storage, "preferences");
  preferences.registerSchema({
    properties: {
      size: { type: "number", scope: "project", default: 0 },
      other: { type: "number", scope: "project", default: 0 },
    },
  });
  let renders = 0;
  let shown: unknown;
  const Capture = ({ projectId }: { projectId: string }) => {
    shown = usePreferenceEntries(preferences, ["size"], () => projectId)[0]?.value;
    renders++;
    return null;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture projectId="a" />);
    });
    expect(shown).toBe(0);
    await act(async () => writer.setValue("size", 1, { scope: "project", scopeId: "a" }));
    expect(shown).toBe(1);
    const accepted = renders;
    await act(async () => {
      writer.setValue("size", 2, { scope: "project", scopeId: "b" });
      writer.setValue("other", 3, { scope: "project", scopeId: "a" });
    });
    expect(renders).toBe(accepted);
    await act(async () => renderer!.update(<Capture projectId="b" />));
    expect(shown).toBe(2);
    await act(async () => renderer!.unmount());
    const unmounted = renders;
    writer.setValue("size", 4, { scope: "project", scopeId: "b" });
    expect(renders).toBe(unmounted);
  } finally {
    await act(async () => renderer?.unmount());
    await preferences.dispose?.();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
