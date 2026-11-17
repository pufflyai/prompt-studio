import { afterEach, beforeEach, expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import psTheme from "../../theme/theme";
import { DiffViewer, type DiffViewerProps } from "./diff-viewer";
import { FileListPanel } from "./file-list-panel";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
beforeEach(() => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), { nodeType: 9, defaultView: globalThis, getElementById: () => null }),
  });
});
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

test("controlled diff selection survives a loading summary and unloaded bodies, then reports user selection", async () => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const changed: (string | null)[] = [];
  let tree: ReactTestRenderer | undefined;
  const render = (props: Partial<DiffViewerProps>) => (
    <ChakraProvider value={psTheme}>
      <DiffViewer diffs={[]} selectedPath="b.ts" onSelectedPathChange={(path) => changed.push(path)} {...props} />
    </ChakraProvider>
  );
  try {
    await act(async () => {
      tree = create(render({ loading: true }));
    });
    expect(changed).toEqual([]);
    await act(async () => {
      tree!.update(render({ changedFilePaths: ["a.ts", "b.ts"] }));
    });
    expect(tree!.root.findByType(FileListPanel).props.selectedPath).toBe("b.ts");
    expect(changed).toEqual([]);
    await act(async () => {
      tree!.root.findByType(FileListPanel).props.onSelectPath("a.ts");
    });
    expect(changed).toEqual(["a.ts"]);
    expect(tree!.root.findByType(FileListPanel).props.selectedPath).toBe("b.ts");
    await act(async () => {
      tree!.update(render({ changedFilePaths: ["a.ts", "b.ts"], selectedPath: "a.ts" }));
    });
    expect(tree!.root.findByType(FileListPanel).props.selectedPath).toBe("a.ts");
  } finally {
    await act(async () => {
      tree?.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

test("uncontrolled diff selection preserves a user choice while its body is unloaded", async () => {
  const previous = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(
        <ChakraProvider value={psTheme}>
          <DiffViewer diffs={[]} changedFilePaths={["a.ts", "b.ts"]} />
        </ChakraProvider>,
      );
    });
    expect(tree!.root.findByType(FileListPanel).props.selectedPath).toBe("a.ts");
    await act(async () => {
      tree!.root.findByType(FileListPanel).props.onSelectPath("b.ts");
    });
    expect(tree!.root.findByType(FileListPanel).props.selectedPath).toBe("b.ts");
  } finally {
    await act(async () => {
      tree?.unmount();
    });
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
