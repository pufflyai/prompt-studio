import "@pstdio/ui/style.css";
import { Flex, Spinner, Stack, Text, Textarea } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView, type TextEditingSession } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import * as Y from "yjs";
import { replaceText } from "./text-input";

const Editor = (props: { session: TextEditingSession }) => {
  const { session } = props;
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [failure, setFailure] = useState("");
  return (
    <Stack gap="xs" p="md">
      <Text textStyle="label/S/regular" color="fg.muted">
        Installed text editor
      </Text>
      {snapshot.pending && (
        <Flex gap="xs" align="center" bg="bg.muted" px="sm" py="xs">
          <Spinner size="xs" color="fg.muted" aria-label="Saving" />
          <Text textStyle="label/S/regular" color="fg.muted">
            Saving changes…
          </Text>
        </Flex>
      )}
      <Textarea
        aria-label="Installed editor source"
        value={snapshot.text.toString()}
        readOnly={!snapshot.editable || snapshot.closing}
        textStyle="mono/M"
        h="lg"
        onChange={(event) => {
          try {
            session.transact((text) => replaceText(text, event.target.value));
            void session.project().catch((error) => setFailure(String(error)));
          } catch (error) {
            setFailure(String(error));
          }
        }}
      />
      {(snapshot.error || failure) && (
        <Text role="alert" color="fg.error" textStyle="label/S/regular">
          {snapshot.error?.message ?? failure}
        </Text>
      )}
    </Stack>
  );
};

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient(host);
    const root = createRoot(mount);
    let disposed = false;
    let session: TextEditingSession | undefined;
    const start = async () => {
      const grant = await client.editing.text.current();
      // A source ref is local to this publisher. It cannot reach the other publisher's private source.
      try {
        const unexpected = await client.editing.text.open({ sourceId: "private-body", params: {} });
        await unexpected.close();
        throw new Error("An unselected source was admitted");
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error)) throw error;
        mount.dataset.unselectedSource = String(error.code);
      }
      session = await client.editing.text.open(grant ? { grant } : { sourceId: "own", params: {} });
      if (disposed) {
        await session.close();
        return;
      }
      const text = session.getSnapshot().text;
      if (!(text instanceof Y.Text) || !(text.doc instanceof Y.Doc)) throw new Error("Yjs runtimes differ");
      mount.dataset.publicYjs = "compatible";
      mount.dataset.selectedSource = String(!!grant);
      root.render(
        <ChakraProvider value={psTheme}>
          <Editor session={session} />
        </ChakraProvider>,
      );
    };
    void start().catch((error) => {
      if (!disposed) mount.textContent = error instanceof Error ? error.message : String(error);
    });
    return () => {
      disposed = true;
      root.unmount();
      void session?.close().catch(() => {});
    };
  },
});
