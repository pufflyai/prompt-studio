import { expect, test } from "bun:test";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { LogoLoader } from "./logo-loader";
import { logoAtRest, logoPath } from "./logo-loader-motion";

test("the mounted logo stops and resumes when the reduced motion preference changes", async () => {
  const preference = Object.assign(new EventTarget(), { matches: false });
  const setReducedMotion = (matches: boolean) => {
    preference.matches = matches;
    preference.dispatchEvent(new Event("change"));
  };
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const globals = {
    IS_REACT_ACT_ENVIRONMENT: true,
    window: { matchMedia: () => preference },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  };
  const previous = Object.entries(globals).map(([key, value]) => {
    const definition = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    return [key, definition] as const;
  });
  const attributes = new Map<string, string>();
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(
        <ChakraProvider value={defaultSystem}>
          <LogoLoader />
        </ChakraProvider>,
        { createNodeMock: () => ({ setAttribute: (key: string, value: string) => attributes.set(key, value) }) },
      );
    });
    expect(frames.size).toBe(1);
    const [id, tick] = [...frames][0]!;
    frames.delete(id);
    tick(performance.now() + 300);
    expect(attributes.get("d")).not.toBe(logoPath(logoAtRest));

    setReducedMotion(true);
    expect(frames.size).toBe(0);
    expect(attributes.get("d")).toBe(logoPath(logoAtRest));
    expect(attributes.get("transform")).toBe("rotate(0 13 13)");

    setReducedMotion(false);
    expect(frames.size).toBe(1);

    await act(async () => renderer?.unmount());
    renderer = undefined;
    expect(frames.size).toBe(0);
    setReducedMotion(true);
    setReducedMotion(false);
    expect(frames.size).toBe(0);
  } finally {
    await act(async () => renderer?.unmount());
    for (const [key, definition] of previous) {
      if (definition) Object.defineProperty(globalThis, key, definition);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
