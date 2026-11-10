from pathlib import Path

def replace(path, before, after):
    p = Path(path)
    text = p.read_text()
    assert text.count(before) == 1, (path,before)
    p.write_text(text.replace(before,after))

replace("packages/ui/src/components/chat-ui/components/chat-panel.tsx",
    "  const merged = normalizeChatMessagesForDisplay(messages, { streaming });",
    "  const observations = globalThis as typeof globalThis & { __chatObservation?: Record<string, unknown> };\n  (observations.__chatObservation ??= {})[conversationKey ?? 'unknown'] = { messages, streaming };\n  const merged = normalizeChatMessagesForDisplay(messages, { streaming });")
replace("packages/ui/src/components/chat-ui/components/ai-conversation.tsx",
    "  const { isAtBottom, scrollToBottom } = useStickToBottomContext();",
    "  const { isAtBottom, scrollToBottom, scrollRef } = useStickToBottomContext();\n  const observation = globalThis as typeof globalThis & { __chatFollow?: unknown[] };\n  (observation.__chatFollow ??= []).push({ time: Date.now(), viewport: scrollRef.current?.id, isAtBottom });\n  if (observation.__chatFollow.length > 128) observation.__chatFollow.shift();")
replace("packages/ui/src/components/chat-ui/components/use-conversation-visibility.ts",
    "      const isHidden = viewport.getClientRects().length === 0;",
    "      const isHidden = viewport.getClientRects().length === 0;\n      const observation = globalThis as typeof globalThis & { __chatVisibility?: unknown[] };\n      (observation.__chatVisibility ??= []).push({ time: Date.now(), viewport: viewport.id, isHidden, hidden, position });\n      if (observation.__chatVisibility.length > 128) observation.__chatVisibility.shift();")
replace("packages/e2e/src/packaged/packaged-chat-motion-smoke.p2.test.ts",
    "              url: location.href,",
    "              url: location.href,\n              chat: (globalThis as typeof globalThis & { __chatObservation?: unknown }).__chatObservation,\n              follow: (globalThis as typeof globalThis & { __chatFollow?: unknown[] }).__chatFollow,\n              visibility: (globalThis as typeof globalThis & { __chatVisibility?: unknown[] }).__chatVisibility,")
