import type { ChatDraft } from "@pstdio/sdk/extensions";
import type { ChatInputQuestionResponse } from "@pstdio/ui/chat-ui";
import type { ChatSession } from "../../../extensions/contributions/chat-session";
import { handoffNativeChatInput } from "./native-chat-action";
import type { NativeChatHostServices } from "./native-chat-host";

/** All composer sends, including queue edits, share the trusted account channel. */
export const submitWithNativeChatAccount = async (
  account: NativeChatHostServices["account"],
  text: string | undefined,
  send: () => Promise<unknown>,
) => {
  if (account?.progress) throw new Error("Finish or cancel harness authentication before sending a message.");
  if (text !== undefined && account?.isCommand(text)) {
    await account.submit(text);
    return;
  }
  account?.assertReady();
  await send();
};

export const nativeChatInputHandler =
  (input: {
    account: NativeChatHostServices["account"];
    session: ChatSession;
    run: ChatSession["run"];
    draft: Pick<ChatDraft, "attachments" | "values">;
  }) =>
  (text: string, _files: string[], questionResponse?: ChatInputQuestionResponse) =>
    submitWithNativeChatAccount(input.account, questionResponse ? undefined : text, () =>
      handoffNativeChatInput(input.session, () =>
        input.run({
          type: "submit",
          text,
          attachments: questionResponse ? [] : input.draft.attachments,
          values: input.draft.values,
          questionResponse,
        }),
      ),
    );
