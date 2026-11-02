import { afterEach, expect, test } from "bun:test";
import { act, create } from "react-test-renderer";
import { installMockLocalStorage } from "../test-utils/local-storage";
import type { FileIconThemePreferenceOption } from "./apply-file-icon-theme-preference";
import { FileIconThemePreferenceProvider, useFileIconThemePreference } from "./file-icon-theme-preference";
import { UiScopeProvider } from "./ui-scope";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});
const theme = (id: string): FileIconThemePreferenceOption => ({
  id,
  definitions: {},
  fileExtensions: {},
  fileNames: {},
  defaults: {},
  fonts: [],
});

test("failed icon persistence keeps the window's choice through switching, registry changes and remounts", async () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const storage = installMockLocalStorage();
  storage.setItem("file-icon-theme-preference", "icons.one");
  storage.setItem = () => {
    throw new Error("Storage unavailable");
  };
  const contexts: Record<string, ReturnType<typeof useFileIconThemePreference>> = {};
  const Probe = (props: { id: string }) => {
    contexts[props.id] = useFileIconThemePreference();
    return null;
  };
  const Scene = (props: { active: boolean; includeChoice: boolean; generation?: number }) => (
    <>
      <UiScopeProvider active={props.active}>
        <FileIconThemePreferenceProvider themePreferences={[theme("icons.one"), theme("icons.two")]}>
          <Probe id="a" />
        </FileIconThemePreferenceProvider>
      </UiScopeProvider>
      <UiScopeProvider active={!props.active}>
        <FileIconThemePreferenceProvider
          key={props.generation}
          themePreferences={props.includeChoice ? [theme("icons.one"), theme("icons.two")] : [theme("icons.one")]}
        >
          <Probe id="b" />
        </FileIconThemePreferenceProvider>
      </UiScopeProvider>
    </>
  );
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Scene active includeChoice={false} />);
  });
  await act(async () => contexts.a.setFileIconThemePreference("icons.two"));
  expect(contexts.a.fileIconThemePreference).toBe("icons.two");
  expect(contexts.b.fileIconThemePreference).toBe("icons.one");
  await act(async () => renderer.update(<Scene active={false} includeChoice generation={1} />));
  expect(contexts.a.fileIconThemePreference).toBe("icons.two");
  expect(contexts.b.fileIconThemePreference).toBe("icons.two");
  expect(storage.getItem("file-icon-theme-preference")).toBe("icons.one");
  await act(async () => renderer.unmount());
});
