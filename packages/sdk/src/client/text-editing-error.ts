import type { TextEditingError } from "pstdio-api-contracts/extension-kernel";

export const textEditingException = (error: TextEditingError) =>
  Object.assign(new Error(error.message), error, {
    data: {
      retryable: error.retryable,
      ...(error.cancelledBarrierId ? { cancelledBarrierId: error.cancelledBarrierId } : {}),
    },
  });
