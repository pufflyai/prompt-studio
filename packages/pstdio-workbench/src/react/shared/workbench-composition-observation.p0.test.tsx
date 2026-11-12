import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../core";
import { useWorkbenchCompositionPanels } from "./use-workbench-composition-panels";

test("panel controls evaluate only requested regions and retain callback freshness", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  let scans = 0;
  let available = true;
  workbench.layout.registerPanel({ id: "notes", title: "Notes", region: "side", rendererId: "notes" });
  workbench.modes.registerMode({
    id: "lab",
    activate() {},
    listAddablePanels() {
      scans++;
      return available ? [{ panelId: "notes", region: "side" }] : [];
    },
  });
  workbench.modes.setActiveMode("lab");
  scans = 0;
  let choices: ReturnType<typeof useWorkbenchCompositionPanels<"side" | "secondary">> | undefined;
  const Capture = ({ revision }: { revision: number }) => {
    choices = useWorkbenchCompositionPanels(workbench, ["secondary", "side"]);
    return <span>{revision}</span>;
  };
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      renderer = create(<Capture revision={0} />);
    });
    expect(scans).toBe(2);
    expect(Object.keys(choices!)).toEqual(["secondary", "side"]);
    expect(choices?.side.addable.map((panel) => panel.panelId)).toEqual(["notes"]);
    expect(choices?.secondary.addable.map((panel) => panel.panelId)).toEqual(["notes"]);
    available = false;
    await act(async () => {
      renderer!.update(<Capture revision={1} />);
    });
    expect(scans).toBe(4);
    expect(choices?.side.addable).toHaveLength(0);
    expect(choices?.secondary.addable).toHaveLength(0);
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
