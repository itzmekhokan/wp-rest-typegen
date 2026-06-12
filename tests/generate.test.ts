import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { generate, renderInterface, toResource } from '../src/generate.ts';
import type { ResourceSchema, WPSchemaNode } from '../src/types.ts';

const postSchema: WPSchemaNode = {
	title: 'post',
	type: 'object',
	properties: {
		id: { type: 'integer', context: ['view', 'edit'] },
		status: { type: 'string', enum: ['publish', 'draft'], context: ['view', 'edit'] },
		title: {
			type: 'object',
			context: ['view', 'edit'],
			properties: {
				raw: { type: 'string', context: ['edit'] },
				rendered: { type: 'string', context: ['view', 'edit'] },
			},
		},
	},
};

test('toResource derives PascalCase name and keeps base/namespace', () => {
	const r = toResource('posts', postSchema, 'wp/v2');
	assert.equal(r.name, 'Post');
	assert.equal(r.restBase, 'posts');
	assert.equal(r.namespace, 'wp/v2');
});

test('renderInterface filters top-level properties by context', () => {
	const r = toResource('posts', postSchema);
	const view = renderInterface(r, { context: 'view' });
	const edit = renderInterface(r, { context: 'edit' });
	assert.match(view, /export interface Post \{/);
	assert.doesNotMatch(view, /raw: string/); // edit-only nested field hidden
	assert.match(edit, /raw: string;/);
});

test('generate emits a registry keyed by rest base', () => {
	const r = toResource('posts', postSchema, 'wp/v2');
	const out = generate([r], { context: 'view' });
	assert.match(out, /export interface WPRestTypes \{/);
	assert.match(out, /"posts": Post;/);
});

test('--no-registry suppresses the registry', () => {
	const r = toResource('posts', postSchema);
	const out = generate([r], { context: 'view', registry: false });
	assert.doesNotMatch(out, /WPRestTypes/);
});

test('duplicate interface names are de-duplicated', () => {
	const a = toResource('posts', { ...postSchema, title: 'thing' });
	const b = toResource('items', { ...postSchema, title: 'thing' });
	const out = generate([a, b]);
	assert.match(out, /export interface Thing \{/);
	assert.match(out, /export interface Thing2 \{/);
});

test('colliding rest bases get namespace-qualified registry keys', () => {
	const a: ResourceSchema = toResource('categories', { title: 'category', type: 'object', properties: {} }, 'wp/v2');
	const b: ResourceSchema = toResource('categories', { title: 'ability-category', type: 'object', properties: {} }, 'wp-abilities/v1');
	const out = generate([a, b]);
	assert.match(out, /"wp\/v2\/categories": Category;/);
	assert.match(out, /"wp-abilities\/v1\/categories": AbilityCategory;/);
	// The bare "categories" key must NOT appear (would be ambiguous).
	assert.doesNotMatch(out, /\t"categories":/);
});

test('output ends with a single trailing newline', () => {
	const out = generate([toResource('posts', postSchema)]);
	assert.ok(out.endsWith('}\n'));
	assert.ok(!out.endsWith('\n\n'));
});
