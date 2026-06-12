#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { discover } from './discover.ts';
import { generate, toResource } from './generate.ts';
import type { Context, ResourceSchema, WPRouteOptions, WPSchemaNode } from './types.ts';

const HELP = `wp-rest-typegen — generate TypeScript types from a WordPress REST API.

Usage:
  wp-rest-typegen <site-url> [options]
  wp-rest-typegen --input <file.json> [options]

Options:
  --url <url>          Site URL (or pass it positionally). e.g. https://example.com
  --input <file>       Read schemas from a local JSON dump instead of the network.
  -o, --out <file>     Write to a file instead of stdout.
  --context <ctx>      view | edit | embed  (default: view)
  --include <a,b>      Only generate these rest bases (comma-separated).
  --exclude <a,b>      Skip these rest bases.
  --namespace <ns>     Only routes in this namespace, e.g. wp/v2.
  --header <k:v>       Extra request header (repeatable), e.g. for auth.
  --insecure           Skip TLS verification (self-signed certs, e.g. *.local).
  --no-registry        Omit the WPRestTypes registry interface.
  -h, --help           Show this help.

Examples:
  wp-rest-typegen https://example.com -o wp-types.d.ts
  wp-rest-typegen https://example.com --context edit --include posts,pages
  wp-rest-typegen --input ./schema-dump.json -o wp-types.d.ts
`;

function parseHeaders(values: string[] | undefined): Record<string, string> | undefined {
	if (!values?.length) return undefined;
	const headers: Record<string, string> = {};
	for (const entry of values) {
		const idx = entry.indexOf(':');
		if (idx === -1) continue;
		headers[entry.slice(0, idx).trim()] = entry.slice(idx + 1).trim();
	}
	return headers;
}

function splitList(value: string | undefined): string[] | undefined {
	return value ? value.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
}

/**
 * Normalize an offline JSON dump into resources. Accepts:
 *   - a single WP schema object (`{ title, properties }`)
 *   - an OPTIONS envelope (`{ schema: {...} }`)
 *   - an array of either of the above
 *   - a map of `{ restBase: schema | envelope }`
 */
function resourcesFromDump(data: unknown): ResourceSchema[] {
	const unwrap = (node: unknown): WPSchemaNode | null => {
		if (!node || typeof node !== 'object') return null;
		const obj = node as WPRouteOptions & WPSchemaNode;
		if (obj.schema && typeof obj.schema === 'object') return obj.schema;
		if (obj.properties || obj.type === 'object') return obj as WPSchemaNode;
		return null;
	};

	if (Array.isArray(data)) {
		return data
			.map((item) => unwrap(item))
			.filter((s): s is WPSchemaNode => !!s)
			.map((s) => toResource(s.title || 'resource', s));
	}

	const single = unwrap(data);
	if (single) return [toResource(single.title || 'resource', single)];

	// Treat as a map of base -> schema/envelope.
	const out: ResourceSchema[] = [];
	for (const [base, value] of Object.entries(data as Record<string, unknown>)) {
		const schema = unwrap(value);
		if (schema) out.push(toResource(base, schema));
	}
	return out;
}

async function main(argv: string[]): Promise<number> {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			url: { type: 'string' },
			input: { type: 'string' },
			out: { type: 'string', short: 'o' },
			context: { type: 'string', default: 'view' },
			include: { type: 'string' },
			exclude: { type: 'string' },
			namespace: { type: 'string' },
			header: { type: 'string', multiple: true },
			insecure: { type: 'boolean', default: false },
			registry: { type: 'boolean', default: true },
			help: { type: 'boolean', short: 'h' },
		},
	});

	if (values.help) {
		process.stdout.write(HELP);
		return 0;
	}

	const context = values.context as Context;
	if (!['view', 'edit', 'embed'].includes(context)) {
		process.stderr.write(`error: --context must be view, edit, or embed\n`);
		return 1;
	}

	let resources: ResourceSchema[];
	if (values.input) {
		const raw = await readFile(values.input, 'utf8');
		resources = resourcesFromDump(JSON.parse(raw));
		const include = splitList(values.include);
		const exclude = splitList(values.exclude);
		if (include) resources = resources.filter((r) => include.includes(r.restBase));
		if (exclude) resources = resources.filter((r) => !exclude.includes(r.restBase));
	} else {
		const site = values.url ?? positionals[0];
		if (!site) {
			process.stderr.write('error: provide a site URL or --input.\n\n' + HELP);
			return 1;
		}
		resources = await discover(site, {
			include: splitList(values.include),
			exclude: splitList(values.exclude),
			namespace: values.namespace,
			insecure: values.insecure,
			headers: parseHeaders(values.header),
		});
	}

	if (resources.length === 0) {
		process.stderr.write('error: no typeable resources found.\n');
		return 1;
	}

	const output = generate(resources, { context, registry: values.registry });

	if (values.out) {
		await writeFile(values.out, output, 'utf8');
		process.stderr.write(
			`Wrote ${resources.length} interface(s) to ${values.out} (context: ${context}).\n`
		);
	} else {
		process.stdout.write(output);
	}
	return 0;
}

main(process.argv.slice(2))
	.then((code) => process.exit(code))
	.catch((err) => {
		process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
		process.exit(1);
	});
