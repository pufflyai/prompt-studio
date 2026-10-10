import { useEffect, useRef } from "react";
import { DEMO_CLI_EVENT, type DemoCliCommand } from "../content/demo-cli-commands";

/** The static preview applies agent commands to the same state as its controls. */
export const useDemoCli = <Tool extends DemoCliCommand["tool"]>(
  tool: Tool,
  run: (command: Extract<DemoCliCommand, { tool: Tool }>) => void,
) => {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current!;
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<DemoCliCommand>).detail;
      if (command.tool === tool) run(command as Extract<DemoCliCommand, { tool: Tool }>);
    };
    host.addEventListener(DEMO_CLI_EVENT, onCommand);
    return () => host.removeEventListener(DEMO_CLI_EVENT, onCommand);
  }, [tool, run]);
  return hostRef;
};
