# wp-rest-typegen

Generate TypeScript types straight from a **live WordPress REST API** — not just core
endpoints, but every custom post type, custom field (`register_rest_field`), and
taxonomy registered on the site. **Zero runtime dependencies** (Node 22's built-in
`fetch` + native TypeScript execution).

```bash
npx wp-rest-typegen https://example.com -o wp-types.d.ts
```

## Why

WordPress already exposes a full JSON Schema for every resource (via an `OPTIONS`
request to each route). Today most projects hand-write these types or reach for a
heavy generic OpenAPI generator that knows nothing about WordPress. `wp-rest-typegen`
reads the schema the site is already publishing and emits clean, WP-aware types —
including the `view` / `edit` / `embed` **context** model that core OpenAPI tools miss.

## Usage

```bash
# Discover every typeable collection on a site
wp-rest-typegen https://example.com -o wp-types.d.ts

# Edit-context types (includes raw fields, edit-only meta) with an auth token
wp-rest-typegen https://example.com --context edit \
  --header "Authorization: Bearer <token>" -o wp-types.d.ts

# Only a subset of resources
wp-rest-typegen https://example.com --include posts,pages,product

# Offline: generate from a saved OPTIONS dump (no network)
wp-rest-typegen --input ./schema-dump.json -o wp-types.d.ts
```

### Options

| Flag             | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `<site-url>`     | Site URL (positional) or `--url`.                      |
| `--input <file>` | Read schemas from a local JSON dump instead of HTTP.   |
| `-o, --out`      | Output file (defaults to stdout).                      |
| `--context`      | `view` \| `edit` \| `embed` (default `view`).          |
| `--include`      | Comma-separated rest bases to keep.                    |
| `--exclude`      | Comma-separated rest bases to drop.                    |
| `--namespace`    | Only routes in this namespace, e.g. `wp/v2`.           |
| `--header k:v`   | Extra request header (repeatable) — e.g. for auth.     |
| `--insecure`     | Skip TLS verification (self-signed certs, e.g. `*.local`). |
| `--no-registry`  | Omit the `WPRestTypes` registry interface.             |

### Local / self-signed sites

Local by Flywheel, DevKinsta, and similar tools serve `https://*.local` with a
self-signed certificate that Node's `fetch` rejects. Either target the plain-HTTP
URL, or pass `--insecure`:

```bash
wp-rest-typegen https://testwp.local --insecure -o wp-types.d.ts
```

## Context-aware output

The same `Post` resource differs by context. In `view` the edit-only `title.raw`
is absent; in `edit` it appears:

```ts
// --context view
export interface Post {
  title: { rendered: string };
}

// --context edit
export interface Post {
  title: { raw: string; rendered: string };
}
```

## Programmatic API

```ts
import { discover, generate } from 'wp-rest-typegen';

const resources = await discover('https://example.com', { include: ['posts'] });
const dts = generate(resources, { context: 'view' });
```

## Registry type

Every run also emits a `WPRestTypes` interface mapping each REST base to its type,
which pairs nicely with `@wordpress/core-data` / `@wordpress/api-fetch` wrappers:

```ts
export interface WPRestTypes {
  posts: Post;
  pages: Page;
  product: Product;
}
```

## License

GPL-2.0-or-later
