import { expect, test } from "bun:test";
import { StrictMode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { nativeTextFixture } from "../../../extensions/bridge/native-text-presentation.test-fixture";
import { usePublicTextPresentation } from "./use-public-text-presentation";

test("native text admits once through a StrictMode mount and still closes on unmount", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const fixture = nativeTextFixture();
  let tree: ReactTestRenderer | undefined;
  const Probe = () => {
    const { session } = usePublicTextPresentation(fixture.connect, true);
    return <span>{session ? "ready" : "opening"}</span>;
  };
  try {
    await act(async () => {
      tree = create(
        <StrictMode>
          <Probe />
        </StrictMode>,
      );
    });
    while (JSON.stringify(tree!.toJSON()).includes("opening"))
      await act(async () => {
        await Bun.sleep(0);
      });
    expect(fixture.calls.filter((call) => call === "open")).toHaveLength(1);
    expect(fixture.calls).not.toContain("disconnect");
    await act(async () => tree!.unmount());
    tree = undefined;
    await fixture.workbench.dispose();
    expect(fixture.calls).toContain("disconnect");
  } finally {
    await act(async () => tree?.unmount());
    await fixture.stop();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
