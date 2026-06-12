# Contributing

Thanks for your interest in wp-rest-typegen! This is a small, dependency-free tool —
contributions that keep it that way are very welcome.

## Prerequisites

- **Node ≥ 22.6** — the package runs TypeScript directly with no build step, so a
  recent Node is required (`node --version`).

## Getting started

```bash
git clone https://github.com/itzmekhokan/wp-rest-typegen.git
cd wp-rest-typegen
npm install        # installs dev tooling only (typescript, @types/node)
```

## Development workflow

| Command             | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm test`          | Run the `node:test` suite (`tests/*.test.ts`).        |
| `npm run typecheck` | Type-check the whole project with `tsc --noEmit`.     |
| `npm run demo`      | Run the generator against the offline fixture.        |

Both `npm test` and `npm run typecheck` must pass before a PR can be merged — CI
runs them on Node 22 and 24.

## Guidelines

- **No runtime dependencies.** The package must keep `"dependencies": {}`. Build on
  Node built-ins (`node:fs`, `node:util`, global `fetch`). Dev-only tooling is fine.
- **Add a test** for any behaviour change. The discovery layer is tested by mocking
  `globalThis.fetch` (see `tests/discover.test.ts`) — no network access in tests.
- **Match the existing style** — tabs for indentation, no semicolon-free experiments,
  small focused functions with a short doc comment.
- Keep the CLI surface stable; new flags should have sensible defaults.

## Reporting bugs / requesting features

Please use the issue templates. For schema-conversion bugs, include the relevant
slice of the offending JSON Schema (an `OPTIONS` response from the route) so it can
be reproduced offline.

## License

By contributing, you agree that your contributions are licensed under the
GPL-2.0-or-later license that covers the project.
