import type { OrderedJournal } from "./ordered-journal";

/** Page payloads in queue order; never materialize the whole offline journal. */
export async function* pendingOrderedOperations(journal: OrderedJournal, ids?: string[]) {
  let after = 0;
  while (true) {
    const page = ids ? await journal.pendingFor(ids, { after }) : await journal.pending({ after });
    if (!page.length) return;
    for (const local of page) yield local;
    after = page.at(-1)!.sequence;
  }
}
