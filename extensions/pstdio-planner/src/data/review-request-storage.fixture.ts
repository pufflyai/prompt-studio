import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { readReviewRequestPage } from "./review-request-storage";

// Existing small behavior fixtures inspect one bounded history window.
export const listTicketReviewRequests = async (storage: ExtensionStorageApi, ticketId: string) => {
  const { requests, errors } = await readReviewRequestPage(
    storage,
    { field: "ticketId", op: "eq", value: ticketId },
    0,
    100,
  );
  return { requests, errors };
};
