import { expect, test } from "bun:test";
import { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { useMessageFadeIn } from "./chat-message-animation";

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

const Message = ({ id, animations }: { id: string; animations: Set<string> }) => {
  const fade = useMessageFadeIn(id, animations);
  return <div data-fading={Boolean(fade)} />;
};

test("a committed message fades once across confirmation and virtual remounts", async () => {
  const animations = new Set(["submission"]);
  let mounted!: ReactTestRenderer;
  await act(() => {
    mounted = create(
      <StrictMode>
        <Message id="submission" animations={animations} />
      </StrictMode>,
    );
  });
  expect(mounted.root.findByType("div").props["data-fading"]).toBe(true);
  await act(() => {
    mounted.update(
      <StrictMode>
        <Message id="submission" animations={new Set()} />
      </StrictMode>,
    );
  });
  expect(mounted.root.findByType("div").props["data-fading"]).toBe(true);
  await act(() => mounted.unmount());

  // Confirmation and virtual remounts share the original submission's identity, even before 200ms elapses.
  await act(() => {
    mounted = create(<Message id="submission" animations={animations} />);
  });
  expect(mounted.root.findByType("div").props["data-fading"]).toBe(false);
  await act(() => mounted.unmount());

  await act(() => {
    mounted = create(<Message id="next-submission" animations={new Set(["next-submission"])} />);
  });
  expect(mounted.root.findByType("div").props["data-fading"]).toBe(true);
  await act(() => mounted.unmount());
});
