import { expect, test } from "bun:test";
import { createReactRenderOverlay } from "./react-render-overlay";

const fixture = () => {
  const stored = new Map([["react-scan-options", '{"enabled":true}']]);
  let enabled = true;
  let starts = 0;
  const visibility: boolean[] = [];
  const overlay = createReactRenderOverlay({
    storage: {
      removeItem: (key: string) => {
        stored.delete(key);
      },
    },
    scanner: {
      isSupported: () => true,
      scan: (options) => {
        enabled = options.enabled === true;
        starts++;
      },
      setOptions: (options) => {
        enabled = options.enabled === true;
        stored.set("react-scan-options", JSON.stringify({ enabled }));
      },
    },
    setVisible: (visible) => {
      visibility.push(visible);
    },
  });
  return { overlay, stored, visibility, starts: () => starts, scanning: () => enabled };
};

test("starts off despite stored options and resumes one scanner across toggles", () => {
  const { overlay, stored, visibility, starts } = fixture();
  expect(overlay.state()).toMatchObject({ supported: true, enabled: false, scope: "workbench" });
  expect(stored.has("react-scan-options")).toBe(false);
  overlay.setEnabled(true);
  expect(overlay.state().enabled).toBe(true);
  overlay.setEnabled(false);
  expect(overlay.state().enabled).toBe(false);
  overlay.setEnabled(true);
  expect(starts()).toBe(1);
  expect(visibility.at(-1)).toBe(true);
  overlay.setEnabled(false);
  expect(visibility.at(-1)).toBe(false);
});

test("an unsupported renderer cannot claim to be scanning", () => {
  const overlay = createReactRenderOverlay({
    scanner: {
      isSupported: () => false,
      scan: () => {
        throw new Error("must not start");
      },
      setOptions: () => {},
    },
    setVisible: () => {},
  });
  expect(overlay.state().supported).toBe(false);
  expect(() => overlay.setEnabled(true)).toThrow("React Scan is unavailable");
  overlay.setEnabled(false);
});

test("records independently of highlights and clears capture when its owner goes away", () => {
  const { overlay, visibility, scanning } = fixture();
  overlay.startCapture(() => {});
  expect(scanning()).toBe(true);
  expect(overlay.readCapture()?.status).toBe("recording");
  expect(visibility.at(-1)).toBe(false);
  expect(() => overlay.startCapture(() => {})).toThrow("already running");
  overlay.clearCapture();
  expect(scanning()).toBe(false);
  expect(overlay.readCapture()).toBeUndefined();

  overlay.setEnabled(true);
  overlay.startCapture(() => {});
  overlay.clearCapture();
  expect(scanning()).toBe(true);
  expect(visibility.at(-1)).toBe(true);
  overlay.setEnabled(false);
});
