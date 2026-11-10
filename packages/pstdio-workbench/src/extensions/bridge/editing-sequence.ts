const clocks = new WeakMap<object, ReturnType<typeof createSequence>>();
const createSequence = () => {
  let latest = 0;
  let preview = 0;
  return {
    preview(sequence: number) {
      if (sequence <= latest) return false;
      latest = preview = sequence;
      return true;
    },
    complete(sequence: number) {
      latest = Math.max(latest, sequence);
      // Required owner saves use zero internally and commit the current draft.
      return sequence === 0 || preview <= sequence;
    },
    cancel(sequence?: number) {
      if (sequence === undefined) return true;
      latest = Math.max(latest, sequence);
      return preview <= sequence;
    },
  };
};
/** Preview delivery may be obsolete. Every completed command remains required work. */
export const editingSequence = (member: object) => {
  let clock = clocks.get(member);
  if (!clock) {
    clock = createSequence();
    clocks.set(member, clock);
  }
  return clock;
};
