import { defineCommand } from "@pstdio/sdk/extensions";
import { submitChangeRequestCommand } from "./change-requests";

export const submitRevisionCommand = defineCommand({
  id: "submit-revision",
  title: "Record a committed revision",
  cli: true,
  mutating: true,
  params: submitChangeRequestCommand.params,
  async run(ctx, input) {
    const { state: _legacyState, ...variant } = await submitChangeRequestCommand.run(ctx, input);
    return variant;
  },
});
