import type { TerminalEvent, TerminalSessionHandle } from "pstdio-api-contracts";

/** Recent output replayed to a reattaching client, so it sees what ran while it was away. */
const BACKLOG_LIMIT_BYTES = 256 * 1024;

export interface TerminalAttachment {
  event(event: TerminalEvent): void;
  fail(message: string): void;
}

export interface RetainedTerminal {
  readonly session: TerminalSessionHandle;
}

interface Entry extends RetainedTerminal {
  key: string;
  backlog: Uint8Array[];
  backlogBytes: number;
  attachment: TerminalAttachment | undefined;
}

const remember = (entry: Entry, chunk: Uint8Array) => {
  entry.backlog.push(chunk);
  entry.backlogBytes += chunk.byteLength;
  while (entry.backlogBytes > BACKLOG_LIMIT_BYTES && entry.backlog.length > 1) {
    entry.backlogBytes -= entry.backlog.shift()!.byteLength;
  }
};

const joinBacklog = (entry: Entry) => {
  const joined = new Uint8Array(entry.backlogBytes);
  let offset = 0;
  for (const chunk of entry.backlog) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
};

/**
 * Terminals that outlive their socket. A client names each terminal with an attach key; closing
 * its socket detaches it, and a later socket with the same key reattaches. Only an explicit kill
 * or the process exiting ends it.
 */
export const createRetainedTerminals = () => {
  const entries = new Set<Entry>();

  const pump = async (entry: Entry) => {
    try {
      for await (const event of entry.session.events()) {
        if (event.kind === "data") remember(entry, event.chunk);
        entry.attachment?.event(event);
        if (event.kind === "exit") break;
      }
    } catch (cause) {
      entries.delete(entry);
      entry.attachment?.fail(cause instanceof Error ? cause.message : String(cause));
      await entry.session.kill();
    } finally {
      entries.delete(entry);
    }
  };

  return {
    retain(key: string, session: TerminalSessionHandle, attachment: TerminalAttachment): RetainedTerminal {
      const entry: Entry = { key, session, backlog: [], backlogBytes: 0, attachment };
      entries.add(entry);
      void pump(entry);
      return entry;
    },

    /** Attaches to a detached terminal of this key and returns its recent output. */
    attach(key: string, attachment: TerminalAttachment) {
      for (const entry of entries) {
        if (entry.key !== key || entry.attachment) continue;
        entry.attachment = attachment;
        return { terminal: entry as RetainedTerminal, backlog: joinBacklog(entry) };
      }
      return undefined;
    },

    detach(terminal: RetainedTerminal, attachment: TerminalAttachment) {
      const entry = terminal as Entry;
      if (entry.attachment === attachment) entry.attachment = undefined;
    },

    async kill(terminal: RetainedTerminal, signal?: string) {
      const entry = terminal as Entry;
      entries.delete(entry);
      entry.attachment = undefined;
      await entry.session.kill(signal);
    },
  };
};

export type RetainedTerminals = ReturnType<typeof createRetainedTerminals>;
