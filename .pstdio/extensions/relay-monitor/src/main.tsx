import { poll } from "./poll";
import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { Dashboard } from "./dashboard";
import type { Section, Snapshot, WindowRange } from "./model";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient<typeof commands>(host);
    const Page = () => {
      const [range, setRange] = useState<WindowRange>("24h");
      const [section, setSection] = useState<Section>("Overview");
      const [snapshot, setSnapshot] = useState<Snapshot>();
      const [error, setError] = useState<string>();
      const [loading, setLoading] = useState(false);
      const refresh = useRef(() => {});
      const [failures, setFailures] = useState<{ timestamp: string; code: string }[]>();
      const [failureCursor, setFailureCursor] = useState<string | null>(null);
      const [failureNote, setFailureNote] = useState<string>();
      const selection = useRef(0);
      useEffect(() => {
        selection.current++;
        setFailures(undefined);
        setFailureCursor(null);
        setFailureNote(undefined);
        const owner = poll(
          client.commands.history.query({ range, section }),
          (value) => {
            setSnapshot(value);
            setError(undefined);
          },
          () => setError("Monitoring query unavailable"),
          setLoading,
        );
        refresh.current = owner.refresh;
        return () => {
          selection.current++;
          owner.stop();
        };
      }, [range, section]);
      const loadFailures = async (before?: string) => {
        const selected = selection.current;
        try {
          const result = await client.commands.failures({ range, before });
          if (selected === selection.current) {
            setFailures(result.rows);
            setFailureCursor(result.next);
            setFailureNote(
              result.boundaryLimited
                ? "The source page limit was reached at one timestamp. Inspect that boundary in the log backend for additional entries."
                : undefined,
            );
          }
        } catch {
          setError("Failure query unavailable");
        }
      };
      return (
        <Dashboard
          snapshot={snapshot}
          error={error}
          loading={loading}
          range={range}
          section={section}
          onRange={setRange}
          onSection={setSection}
          onRefresh={() => refresh.current()}
          failures={failures}
          failuresNote={failureNote}
          onFailures={() => void loadFailures()}
          onOlder={failureCursor ? () => void loadFailures(failureCursor) : undefined}
        />
      );
    };
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Page />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
