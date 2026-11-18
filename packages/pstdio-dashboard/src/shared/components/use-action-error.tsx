import { ActionErrorSlot, AlertMessage } from "@pstdio/ui";
import { useState } from "react";

interface ActionError {
  title?: string;
  description?: string;
}

export const useActionError = (edge: "top" | "bottom" | "above" = "bottom") => {
  const [error, setError] = useState<ActionError>();
  const clearError = () => setError(undefined);
  return {
    showError: setError,
    clearError,
    errorNotice: error ? (
      <ActionErrorSlot edge={edge}>
        <AlertMessage compact status="error" role="alert" title={error.title} onClose={clearError}>
          {error.description}
        </AlertMessage>
      </ActionErrorSlot>
    ) : null,
  };
};
