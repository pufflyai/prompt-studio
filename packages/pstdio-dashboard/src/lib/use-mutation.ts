import { useRef, useState } from "react";

interface UseMutationResult<TInput, TResult> {
  mutate: (
    input: TInput,
    callbacks?: { onSuccess?: (data: TResult) => void; onError?: (error: Error) => void },
  ) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
}

export function useMutation<TInput, TResult = void>(
  mutationFn: (input: TInput) => Promise<TResult>,
): UseMutationResult<TInput, TResult> {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const versionRef = useRef(0);

  const mutateAsync = async (input: TInput) => {
    const version = ++versionRef.current;
    setIsPending(true);
    setError(null);
    try {
      const result = await mutationFn(input);
      if (version === versionRef.current) setIsPending(false);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (version === versionRef.current) {
        setError(error);
        setIsPending(false);
      }
      throw error;
    }
  };

  const mutate = (
    input: TInput,
    callbacks?: { onSuccess?: (data: TResult) => void; onError?: (error: Error) => void },
  ) => {
    mutateAsync(input)
      .then((data) => callbacks?.onSuccess?.(data))
      .catch((err) => callbacks?.onError?.(err));
  };

  const reset = () => {
    setIsPending(false);
    setError(null);
  };

  return { mutate, mutateAsync, isPending, error, reset };
}
