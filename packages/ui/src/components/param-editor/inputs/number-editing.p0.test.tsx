import { expect, test } from "bun:test";
import { act, create } from "react-test-renderer";
import { useNumberEditing } from "./number-editing";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("numeric drafts preview immediately, retain newer input across an old acknowledgement, and commit once", async () => {
  const previews: number[] = [];
  const commits: number[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = (props: { value: number }) => {
    input = useNumberEditing({
      value: props.value,
      min: 0,
      max: 100,
      step: 1,
      onPreview: (value) => {
        previews.push(value);
      },
      onCommit: async (value) => {
        commits.push(value);
        await held;
      },
      onCancel() {},
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field value={80} />);
  });
  await act(async () => {
    input.focus();
    input.change("50");
  });
  expect(previews).toEqual([50]);
  expect(commits).toEqual([]);
  let saved!: Promise<void>;
  await act(async () => {
    saved = input.commit();
  });
  await act(async () => {
    input.change("60");
    view.update(<Field value={50} />);
  });
  await act(async () => {
    release();
    await saved;
  });
  expect(input.value).toBe("60");
  await act(async () => {
    await input.commit();
    await input.commit();
  });
  expect(commits).toEqual([50, 60]);
  await act(async () => {
    view.unmount();
  });
});

test("invalid, empty, mixed and cancelled numeric gestures create no committed edit", async () => {
  const commits: number[] = [];
  const previews: number[] = [];
  let cancelled = 0;
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      mixed: true,
      min: 0,
      max: 100,
      step: 5,
      onPreview: (value) => {
        previews.push(value);
      },
      onCommit: (value) => {
        commits.push(value);
      },
      onCancel: () => {
        cancelled++;
      },
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field />);
  });
  expect(input.value).toBe("");
  for (const raw of ["", "bad", "101", "2"]) {
    await act(async () => {
      input.change(raw);
      await input.commit();
    });
    expect(input.invalid).toBe(true);
  }
  expect(previews).toEqual([]);
  await act(async () => {
    input.change("55");
  });
  expect(previews).toEqual([55]);
  await act(async () => {
    input.cancel();
    await input.commit();
  });
  expect(input.value).toBe("");
  expect(commits).toEqual([]);
  expect(cancelled).toBeGreaterThan(0);
  await act(async () => {
    view.unmount();
  });
});

test("failed numeric commits retain the authored value and allow explicit completion", async () => {
  let fails = true;
  const commits: number[] = [];
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      onPreview() {},
      onCancel() {},
      onCommit(value) {
        if (fails) throw new Error("Storage unavailable");
        commits.push(value);
      },
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field />);
  });
  await act(async () => {
    input.change("60");
    await input.commit();
  });
  expect(input.value).toBe("60");
  expect(input.error).toBe("Storage unavailable");
  fails = false;
  await act(async () => {
    await input.commit();
  });
  expect(commits).toEqual([60]);
  expect(input.error).toBe("");
  await act(async () => {
    view.unmount();
  });
});

test("a rejected numeric preview stays editable and reports its failure inline", async () => {
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      onPreview: async () => {
        throw new Error("Preview unavailable");
      },
      onCommit() {},
      onCancel() {},
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field />);
  });
  await act(async () => {
    input.change("60");
  });
  expect(input.value).toBe("60");
  expect(input.error).toBe("Preview unavailable");
  await act(async () => {
    input.cancel();
  });
  expect(input.error).toBe("");
  await act(async () => {
    view.unmount();
  });
});

test("completed numeric edits ignore failures from their earlier preview", async () => {
  const preview = Promise.withResolvers<void>();
  const commits: number[] = [];
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      onPreview: () => preview.promise,
      onCancel() {},
      onCommit: (value) => {
        commits.push(value);
      },
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field />);
  });
  await act(async () => {
    input.change("60");
    await input.commit();
  });
  expect(commits).toEqual([60]);
  await act(async () => {
    preview.reject(new Error("Old preview unavailable"));
  });
  expect(input.error).toBe("");
  await act(async () => {
    view.unmount();
  });
});

test("closing a numeric control cancels an unfinished slider drag and completes a typed property", async () => {
  const commits: number[] = [];
  let cancels = 0;
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      onPreview() {},
      onCancel: () => {
        cancels++;
      },
      onCommit: (value) => {
        commits.push(value);
      },
    });
    return null;
  };
  for (const interaction of ["slider", "input"] as const) {
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(<Field />);
    });
    await act(async () => {
      input.change("60", interaction);
    });
    await act(async () => {
      view.unmount();
    });
  }
  expect(commits).toEqual([60]);
  expect(cancels).toBe(1);
});

test("refocusing during a save does not leave acknowledged text pinned after a later blur", async () => {
  const held = Promise.withResolvers<void>();
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = ({ value }: { value: number }) => {
    input = useNumberEditing({ value, onPreview() {}, onCancel() {}, onCommit: () => held.promise });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field value={80} />);
  });
  let saved!: Promise<void>;
  await act(async () => {
    input.focus();
    input.change("60");
    input.blur();
    saved = input.commit();
  });
  await act(async () => {
    input.focus();
    view.update(<Field value={60} />);
    held.resolve();
    await saved;
  });
  await act(async () => {
    input.blur();
    await input.commit();
    view.update(<Field value={70} />);
  });
  expect(input.value).toBe("70");
  await act(async () => {
    view.unmount();
  });
});

test("failed cancellation retains the draft and can be retried without committing it", async () => {
  let fails = true;
  let commits = 0;
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      onPreview() {},
      onCommit: () => {
        commits++;
      },
      onCancel: async () => {
        if (fails) throw new Error("Cancellation unavailable");
      },
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field />);
  });
  await act(async () => {
    input.change("60");
    await input.cancel();
  });
  expect(input.value).toBe("60");
  expect(input.error).toBe("Cancellation unavailable");
  await act(async () => {
    input.blur();
    await input.commit();
  });
  expect(commits).toBe(0);
  expect(input.value).toBe("60");
  fails = false;
  await act(async () => {
    await input.cancel();
  });
  expect(input.value).toBe("80");
  expect(input.error).toBe("");
  expect(commits).toBe(0);
  await act(async () => {
    view.unmount();
  });
});

test("disposing a draft after failed cancellation retries cancellation without saving it", async () => {
  const commits: number[] = [];
  let cancellations = 0;
  let input!: ReturnType<typeof useNumberEditing>;
  const Field = () => {
    input = useNumberEditing({
      value: 80,
      onPreview() {},
      onCommit: (value) => {
        commits.push(value);
      },
      onCancel: () => {
        if (++cancellations === 1) throw new Error("Cancellation unavailable");
      },
    });
    return null;
  };
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(<Field />);
  });
  await act(async () => {
    input.change("60");
    await input.cancel();
  });
  expect(input.error).toBe("Cancellation unavailable");
  await act(async () => {
    view.unmount();
  });
  expect(commits).toEqual([]);
  expect(cancellations).toBe(2);
});
