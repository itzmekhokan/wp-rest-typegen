import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';
import { discover, toApiRoot } from '../src/discover.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

/** Minimal Response stub for the mocked fetch. */
function json(body: unknown) {
	return {
		ok: true,
		status: 200,
		statusText: 'OK',
		json: async () => body,
	} as Response;
}

/**
 * Mock a site whose `/wp/v2/categories` and `/wp-abilities/v1/categories`
 * collide on the rest base `categories` — the exact shape that broke discovery.
 */
function mockSite() {
	const schemas: Record<string, unknown> = {
		'/wp-json/wp/v2/posts': { schema: { title: 'post', type: 'object', properties: { id: { type: 'integer' } } } },
		'/wp-json/wp/v2/categories': { schema: { title: 'category', type: 'object', properties: { id: { type: 'integer' } } } },
		'/wp-json/wp-abilities/v1/categories': { schema: { title: 'ability-category', type: 'object', properties: { slug: { type: 'string' } } } },
	};
	const index = {
		routes: {
			'/': {},
			'/wp/v2/posts': {},
			'/wp/v2/posts/(?P<id>[\\d]+)': {}, // single-item route, must be skipped
			'/wp/v2/categories': {},
			'/wp-abilities/v1/categories': {},
		},
	};

	globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
		const url = String(input);
		if (init?.method === 'OPTIONS') {
			const key = url.replace(/^https?:\/\/[^/]+/, '');
			return json(schemas[key] ?? {});
		}
		return json(index); // GET root
	}) as typeof fetch;
}

test('toApiRoot appends /wp-json once', () => {
	assert.equal(toApiRoot('https://x.test'), 'https://x.test/wp-json');
	assert.equal(toApiRoot('https://x.test/'), 'https://x.test/wp-json');
	assert.equal(toApiRoot('https://x.test/wp-json'), 'https://x.test/wp-json');
});

test('skips single-item routes and keeps collections', async () => {
	mockSite();
	const resources = await discover('https://x.test');
	const bases = resources.map((r) => r.restBase);
	assert.ok(bases.includes('posts'));
	// the `(?P<id>…)` route must not produce a resource
	assert.equal(bases.filter((b) => b === 'posts').length, 1);
});

test('REGRESSION: colliding bases across namespaces are both kept', async () => {
	mockSite();
	const resources = await discover('https://x.test');
	const names = resources.map((r) => r.name).sort();
	// Both the WP category AND the abilities category survive — no silent overwrite.
	assert.deepEqual(names, ['AbilityCategory', 'Category', 'Post']);
});

test('--namespace scopes discovery to one namespace', async () => {
	mockSite();
	const resources = await discover('https://x.test', { namespace: 'wp/v2' });
	const names = resources.map((r) => r.name).sort();
	assert.deepEqual(names, ['Category', 'Post']);
});

test('--include filters by rest base', async () => {
	mockSite();
	const resources = await discover('https://x.test', { include: ['posts'] });
	assert.deepEqual(resources.map((r) => r.restBase), ['posts']);
});
