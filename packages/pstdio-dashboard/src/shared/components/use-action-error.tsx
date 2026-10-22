import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";

interface ActionError {
  title?: string;
  description?: string;
}

export const useActionError = () => {
  const [error, setError] = useState<ActionError>();
  const clearError = () => setError(undefined);
  return {
    showError: setError,
    clearError,
    errorNotice: error ? (
      <AlertMessage status="error" role="alert" title={error.title} onClose={clearError}>
        {error.description}
      </AlertMessage>
    ) : null,
  };
};
