import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { ExtensionFrame } from "pstdio-extensions/bridge/host";
import runtimeScript from "pstdio-extensions/bridge/webview-runtime.bundle.js?raw";
import { renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";
import { useEffect, useState } from "react";

const runtimeUrl = URL.createObjectURL(
  new Blob([renderInlineExtensionRuntimeHtml(runtimeScript)], { type: "text/html" }),
);
const moduleSource = `export default { async mount(root, _host, props) {
  root.innerHTML = '<p id="range"></p><p id="mounted">pending</p><button>Finish mount</button>';
  const draw = () => root.querySelector('#range').textContent = props.get().pageParams.range;
  draw();
  const dispose = props.subscribe(draw);
  await new Promise(resolve => root.querySelector('button').onclick = resolve);
  root.querySelector('#mounted').textContent = 'done';
  return dispose;
} };`;
const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
const view = {
  id: "pending-props",
  label: "Pending props",
  extensionId: "test.pending-props",
  webview: { runtimeUrl, moduleUrl, styles: [] },
};

const PendingExtensionProps = () => {
  const [frameProps, setFrameProps] = useState({ pageParams: { range: "now-6h" } });
  const range = frameProps.pageParams.range;
  const [committedRange, setCommittedRange] = useState(range);
  // Child passive effects run before this marker is published. The guest stays
  // pending until the test observes this host commit and explicitly releases it.
  useEffect(() => setCommittedRange(range), [range]);
  return (
    <Stack height="full" gap="md" padding="md">
      <Button onClick={() => setFrameProps({ pageParams: { range: "now-24h" } })}>Update host props</Button>
      <Text aria-label="Committed host range">{committedRange}</Text>
      <Box flex="1" minH="0">
        <ExtensionFrame title="Pending props" theme="dark" view={view} props={frameProps} />
      </Box>
    </Stack>
  );
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/Pending extension props",
  component: PendingExtensionProps,
  fullscreen: true,
} satisfies CanvasMeta<typeof PendingExtensionProps>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const DuringMount: Story = {
  id: "pstdio-workbench-reference-core-api-pending-extension-props--during-mount",
};
