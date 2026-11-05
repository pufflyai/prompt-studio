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
