# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-06-12

### Fixed
- `--no-registry` was advertised but threw "Unknown option"; enabled `parseArgs`
  negation so it works.
- Exposed the `./package.json` subpath in `exports` so tooling can read it
  (previously `ERR_PACKAGE_PATH_NOT_EXPORTED`).

### Added
- CLI subprocess integration tests covering the flag surface.

## [0.1.1] - 2026-06-12

### Fixed
- Ship compiled JavaScript in `dist/` so the package runs when installed from npm.
  Node refuses to strip TypeScript types under `node_modules`, which broke the
  raw-`.ts` entry in 0.1.0. Runtime stays dependency-free; now requires Node ≥ 20.16.

## [0.1.0] - 2026-06-12

### Added
- Initial release: discover a WordPress REST API and generate context-aware
  TypeScript types for core endpoints, custom post types, fields, and taxonomies.

> **Deprecated** — shipped raw `.ts` and fails on install. Use 0.1.1 or later.

[0.1.2]: https://github.com/itzmekhokan/wp-rest-typegen/releases/tag/v0.1.2
[0.1.1]: https://github.com/itzmekhokan/wp-rest-typegen/releases/tag/v0.1.1
[0.1.0]: https://github.com/itzmekhokan/wp-rest-typegen/releases/tag/v0.1.0
