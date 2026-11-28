# Native questions can block accepted prompts

## 1. When to use

- Changing an agent harness that streams tool arguments or queues prompts in its own inbox.

## 2. Failure

- A streamed question declaration is not yet an executable question. Treating it as idle can release the host run before the native form exists.
- A native inbox can accept a follow-up without adding a conversation message. Waiting for the message count to grow misses a question already present in the baseline.
- Native execution cannot become idle until the person answers. Waiting for idle before exposing that question leaves both sides waiting.

## 3. Prevention

- Distinguish streaming tool arguments, prompt admission, and execution completion.
- After confirmed admission, recognize a running question even when it predates the follow-up. Preserve the accepted native inbox entry and the explicit question-reply path.
- Keep admission errors visible. Test the complete follow-up, question, answer, and continuation sequence without resending the prompt.

## 4. Evidence

- [OpenCode question lifecycle regressions](../../extensions/harness-open-code/src/opencode-pending-question.p0.test.ts)
- [OpenCode question and continuation tests](../../extensions/harness-open-code/src/opencode-question-reply.p0.test.ts)
