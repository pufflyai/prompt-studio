import { expect, test } from "bun:test";
import type { ChatPanel } from "@pstdio/ui/chat-ui";
import type { ComponentProps, ReactElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench } from "../../../core";
import { createChatSession } from "../../../extensions/contributions/chat-session";
import { installResourceChanges } from "../../resource-changes/change-store";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { NativeChatHostProps } from "./native-chat-host";
import { NativeChatView } from "./native-chat-view";

for (const mode of ["reply", "pending question", "inline question", "missing witness"] as const) {
  test(`a focused ${mode} acknowledges only its actual displayed content`, async () => {
    const descriptors = Object.getOwnPropertyDescriptors(globalThis);
    const globals = {
      document: Object.assign(new EventTarget(), {
        visibilityState: "visible",
        hasFocus: () => true,
        querySelector: () => ({ textContent: "" }),
      }),
      window: new EventTarget(),
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    for (const [key, value] of Object.entries(globals))
      Object.defineProperty(globalThis, key, { configurable: true, value });
    const workbench = createWorkbench();
    const resource = { type: "session", extensionId: "pstdio", projectId: "project", id: "session" };
    const receipts: string[] = [];
    const registration = installResourceChanges({
      workbench,
      projectId: "project",
      metadata: { resourceChangeProviders: [{ ...resource, refreshEvents: [] }] },
      resourceChanges: {
        query: async () => [],
        read: async () => {
          throw Error("No duplicate content read");
        },
        acknowledge: async (_project, receipt) => {
          receipts.push(receipt);
          return { resource, stamp: { lineage: "conversation", revision: "1" }, changedSinceSeen: false };
        },
      },
    });
    const question = mode === "pending question" || mode === "inline question";
    const session = createChatSession({
      initial: {
        messages: [
          {
            id: "reply",
            role: "assistant",
            parts: question
              ? [
                  {
                    type: "tool",
                    tool: "question",
                    callId: "new-question",
                    status: "running",
                    state: {
                      input: {
                        questions: [{ question: "New?" }],
                        ...(mode === "inline question" ? { delivery: "async" } : {}),
                      },
                    },
                  },
                ]
              : [{ type: "text", text: "Complete reply" }],
          },
        ],
        observedChange: "receipt",
        ...(mode === "missing witness" ? {} : { observedChangeMessageIds: ["reply"] }),
        ...(question ? { observedChangeQuestionId: "new-question" } : {}),
      },
      query: async () => ({}),
      action: async () => ({}),
    });
    let panel!: ReactElement<ComponentProps<typeof ChatPanel>>;
    const Host = ({ children }: NativeChatHostProps) => {
      panel = children({}) as typeof panel;
      return null;
    };
    let tree: ReactTestRenderer | undefined;
    try {
      await act(async () => {
        tree = create(
          <WorkbenchThemeProvider>
            <NativeChatView
              workbench={workbench}
              resource={resource}
              session={session}
              action={undefined}
              conversationKey="session"
              Host={Host}
            />
          </WorkbenchThemeProvider>,
        );
      });
      expect(receipts).toEqual([]);
      await act(async () => {
        panel.props.onVisibleMessageIdsChange!(["older"]);
      });
      expect(receipts).toEqual([]);
      await act(async () => {
        panel.props.onVisibleMessageIdsChange!(["reply"]);
      });
      if (mode === "pending question") {
        await act(async () => {
          panel.props.onVisibleQuestionChange!("older-question");
        });
        expect(receipts).toEqual([]);
        await act(async () => {
          panel.props.onVisibleQuestionChange!("new-question");
        });
      }
      expect(receipts).toEqual(mode === "missing witness" ? [] : ["receipt"]);
    } finally {
      await act(async () => tree?.unmount());
      registration.dispose();
      await workbench.dispose();
      for (const key of Object.keys(globals)) {
        const descriptor = Object.getOwnPropertyDescriptor(descriptors, key)?.value;
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
}
