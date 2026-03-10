import { useEffect, useRef, useState } from "react";

interface UseFetchResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refetch: () => void;
}

export function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[],
  options?: { enabled?: boolean },
): UseFetchResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const versionRef = useRef(0);

  const enabled = options?.enabled ?? true;

  const doFetch = () => {
    if (!enabled) return;
    const version = ++versionRef.current;
    setIsLoading(true);
    setError(null);
    fetchFn()
      .then((result) => {
        if (version === versionRef.current) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (version === versionRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are user-provided
  useEffect(() => {
    doFetch();
  }, [enabled, ...deps]);

  return { data, isLoading, error, isError: error !== null, refetch: doFetch };
}
