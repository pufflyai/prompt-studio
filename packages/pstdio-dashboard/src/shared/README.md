# shared/

Cross-feature contracts and stores. A file belongs here when:

- It is referenced from **two or more** feature folders, AND
- It is a stable contract (types, store, util) rather than a feature behavior.

Anything in `src/features/<a>/` must not import from `src/features/<b>/`. The
`../../scripts/check-feature-isolation.ts` script enforces this against a
baseline of pre-existing violations; new violations fail the dashboard `lint`
script.

To intentionally accept new violations:

```sh
bun ../../scripts/check-feature-isolation.ts --update-baseline
```

Prefer moving the shared piece into `shared/` instead.
