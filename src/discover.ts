import { toResource } from './generate.ts';
import type { ResourceSchema, WPRouteOptions, WPSchemaNode } from './types.ts';

export interface DiscoverOptions {
	/** Only keep these rest bases (e.g. `['posts', 'pages']`). */
	include?: string[];
	/** Drop these rest bases. */
	exclude?: string[];
	/** Only keep routes in this namespace (e.g. `wp/v2`). */
	namespace?: string;
	/** Skip TLS verification — needed for self-signed certs (e.g. *.local). */
	insecure?: boolean;
	/** Extra request headers (e.g. an auth token for `edit` context). */
	headers?: Record<string, string>;
}

interface RootIndex {
	routes: Record<string, { methods?: string[] }>;
}

function normalizeBase(url: string): string {
	return url.replace(/\/+$/, '');
}

/** Build the wp-json root URL from any site URL (with or without trailing path). */
export function toApiRoot(siteUrl: string): string {
	const base = normalizeBase(siteUrl);
	return base.endsWith('/wp-json') ? base : `${base}/wp-json`;
}

/**
 * A route is a "collection" we can type when it has no path parameters,
 * e.g. `/wp/v2/posts` (keep) vs `/wp/v2/posts/(?P<id>[\d]+)` (skip).
 */
function isCollectionRoute(route: string): boolean {
	if (route === '/') return false;
	if (route.includes('(?P<')) return false;
	const segments = route.split('/').filter(Boolean);
	// namespace (`wp`) + version (`v2`) + base (`posts`) -> 3 segments.
	return segments.length === 3;
}

function restBaseOf(route: string): string {
	const segments = route.split('/').filter(Boolean);
	return segments[segments.length - 1];
}

function namespaceOf(route: string): string {
	const segments = route.split('/').filter(Boolean);
	return segments.slice(0, -1).join('/');
}

async function getJson<T>(url: string, method: string, headers?: Record<string, string>): Promise<T> {
	const res = await fetch(url, { method, headers });
	if (!res.ok) {
		throw new Error(`${method} ${url} -> ${res.status} ${res.statusText}`);
	}
	return (await res.json()) as T;
}

/** Discover every typeable collection route on a site and fetch its schema. */
export async function discover(siteUrl: string, options: DiscoverOptions = {}): Promise<ResourceSchema[]> {
	// Self-signed certs (Local, DevKinsta, etc.) are rejected by undici otherwise.
	// Scoped to this process only; harmless for a local dev codegen tool.
	if (options.insecure) {
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
	}

	const root = toApiRoot(siteUrl);
	const index = await getJson<RootIndex>(root, 'GET', options.headers);

	// Key by the full route so colliding bases across namespaces don't overwrite
	// each other (e.g. /wp/v2/categories vs /wp-abilities/v1/categories).
	const routes = new Map<string, { base: string; namespace: string }>();
	for (const route of Object.keys(index.routes ?? {})) {
		if (!isCollectionRoute(route)) continue;
		const base = restBaseOf(route);
		const namespace = namespaceOf(route);
		if (options.include && !options.include.includes(base)) continue;
		if (options.exclude && options.exclude.includes(base)) continue;
		if (options.namespace && namespace !== options.namespace) continue;
		routes.set(root + route, { base, namespace });
	}

	const resources: ResourceSchema[] = [];
	// Fetch schemas concurrently; OPTIONS returns `{ schema }` per route.
	const results = await Promise.allSettled(
		[...routes].map(async ([url, { base, namespace }]) => {
			const opts = await getJson<WPRouteOptions>(url, 'OPTIONS', options.headers);
			if (!opts.schema || opts.schema.type !== 'object') return null;
			return toResource(base, opts.schema as WPSchemaNode, namespace);
		})
	);

	for (const result of results) {
		if (result.status === 'fulfilled' && result.value) resources.push(result.value);
		else if (result.status === 'rejected') {
			process.stderr.write(`warning: ${result.reason}\n`);
		}
	}

	resources.sort((a, b) => a.restBase.localeCompare(b.restBase));
	return resources;
}
