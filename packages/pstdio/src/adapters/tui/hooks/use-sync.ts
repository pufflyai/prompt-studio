import { useEffect, useState } from "react";
import { API_URL } from "@/features/api-url";
import { startSync } from "@/features/sync/sync-client";

export function useSync() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = startSync(API_URL);

    const interval = setInterval(() => {
      setConnected(client.connected);
    }, 500);

    return () => {
      clearInterval(interval);
      client.close();
    };
  }, []);

  return { connected };
}
