import { describe, expect, it } from "bun:test";
import { AgentBrowserContainer } from "@/features/agents/components/agent-browser.container";
import { SessionChatView } from "@/features/sessions/components/session-chat-view";
import { RepoBrowserContainer } from "./repo-browser.container";
import { SessionChat } from "./session-chat";

const toArray = <T>(value: T | T[]) => (Array.isArray(value) ? value : [value]);

describe("SessionChat", () => {
  it("renders the same selector menu as the session page", () => {
    const element = SessionChat({
      sessionId: "session-1",
      lockedBranch: "main",
    });

    expect(element.type).toBe(SessionChatView);
    expect(element.props.sessionId).toBe("session-1");

    const menu = element.props.repoMenu;
    expect(menu).toBeDefined();

    const menuChildren = toArray(menu.props.children).filter(Boolean);
    expect(menuChildren).toHaveLength(2);
    expect(menuChildren[0]?.type).toBe(AgentBrowserContainer);
    expect(menuChildren[1]?.type).toBe(RepoBrowserContainer);
    expect(menuChildren[1]?.props.lockedBranch).toBe("main");
  });
});
