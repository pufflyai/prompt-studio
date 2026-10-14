import type { Page } from "@playwright/test";
export const readStoryOutcome = async (page: Page) => {
  return page.evaluate(() => {
    const channel = (
      window as unknown as { __STORYBOOK_ADDONS_CHANNEL__?: { last(event: string): unknown[] | undefined } }
    ).__STORYBOOK_ADDONS_CHANNEL__;
    return {
      result: channel?.last("storyFinished")?.[0],
      errors: [
        "storyErrored",
        "storyThrewException",
        "playFunctionThrewException",
        "unhandledErrorsWhilePlaying",
      ].flatMap((event) => channel?.last(event) ?? []),
    };
  });
};
