# Numeric property editing

Use `ParamEditor` for ordinary parameter forms. Use its exported `NumberInput` for an inspector property that needs immediate previews and one durable command per gesture. This follows RB 4.A.7 and the public SDK boundary in RB 6.A.31.

```tsx
import { NumberInput } from "@pstdio/ui/param-editor";

<NumberInput
  id="opacity"
  name="Opacity"
  description="Opacity of the selected layers"
  defaultValue={80}
  unit="%"
  min={0}
  max={100}
  step={1}
  onPreview={(value) => editor.preview(value)}
  onChange={(_id, value) => editor.commit(value)}
  onCancel={() => editor.cancel()}
/>;
```

`onPreview` opts into gesture editing. It receives every valid numeric draft immediately, including slider movement. Its second argument is `"input"` or `"slider"`, so the document owner can complete typed input on defocus while cancelling an unfinished pointer gesture on retirement. `onChange` runs once when a valid input blurs or accepts Enter, or a slider gesture completes. `onCancel` discards the preview on Escape or pointer cancellation. Preview changes must use the same editing session as the completed command; they must not write storage or history. Callbacks may return promises. Commit failures retain the authored value for another completion attempt and show the error inline.

Empty, out-of-range and off-step drafts stay editable and show validation feedback. Incoming values and older acknowledgements do not replace focused authored input. `mixed` shows an empty input with a Mixed placeholder until someone enters a common value. `unit` labels the input and slider; `disabled` and `readOnly` preserve the displayed value while preventing edits. Supply both bounds to show the slider, or set `hideSlider`.

When a control unmounts, a valid unfinished input completes through its captured callback; an invalid draft or unfinished slider drag cancels. The document owner must retain accepted writes after a view closes. Normal saving needs no progress badge. Use the owner's inline recovery action for storage failures.

Without `onPreview`, `NumberInput` retains the existing parameter-form behavior and `changeDelay`. Layout sizes belong in host preferences, separate from document changes and history (RB 6.A.13).

Explore **Product/Extension Lab/Marmalade/Properties → PropertyEditing** and **InspectorGroups** in Canvas. These use synthetic data; host recovery and persistence require a real workspace.

*Updated at: 2026-11-22*
