import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { nodeToType, pascalCase } from '../src/json-schema-to-ts.ts';
import type { Context, WPSchemaNode } from '../src/types.ts';

/** Convenience wrapper around the recursive converter. */
function ts(node: WPSchemaNode, context: Context = 'view'): string {
	return nodeToType(node, { context, indent: '' });
}

test('pascalCase normalizes WP titles', () => {
	assert.equal(pascalCase('post'), 'Post');
	assert.equal(pascalCase('wp_block'), 'WpBlock');
	assert.equal(pascalCase('ability-category'), 'AbilityCategory');
	assert.equal(pascalCase('wc/v3 product'), 'WcV3Product');
});

test('scalar types map to TS primitives', () => {
	assert.equal(ts({ type: 'integer' }), 'number');
	assert.equal(ts({ type: 'number' }), 'number');
	assert.equal(ts({ type: 'string' }), 'string');
	assert.equal(ts({ type: 'boolean' }), 'boolean');
	assert.equal(ts({ type: 'null' }), 'null');
});

test('type arrays become unions', () => {
	assert.equal(ts({ type: ['string', 'null'] }), 'string | null');
});

test('enums become string-literal unions', () => {
	assert.equal(
		ts({ type: 'string', enum: ['publish', 'draft'] }),
		'"publish" | "draft"'
	);
	// Numeric / boolean enum members are emitted bare.
	assert.equal(ts({ enum: [1, 2, true] }), '1 | 2 | true');
	// Duplicate members are de-duped.
	assert.equal(ts({ enum: ['a', 'a', 'b'] }), '"a" | "b"');
});

test('arrays use item types and wrap unions', () => {
	assert.equal(ts({ type: 'array', items: { type: 'integer' } }), 'number[]');
	assert.equal(ts({ type: 'array' }), 'unknown[]');
	assert.equal(
		ts({ type: 'array', items: { type: ['string', 'null'] } }),
		'(string | null)[]'
	);
});

test('objects with no typeable properties become Record', () => {
	assert.equal(ts({ type: 'object' }), 'Record<string, unknown>');
	assert.equal(
		ts({ type: 'object', additionalProperties: { type: 'string' } }),
		'Record<string, string>'
	);
	assert.equal(
		ts({ type: 'object', additionalProperties: false }),
		'Record<string, never>'
	);
});

test('nested objects render inline with context filtering', () => {
	const title: WPSchemaNode = {
		type: 'object',
		properties: {
			raw: { type: 'string', context: ['edit'] },
			rendered: { type: 'string', context: ['view', 'edit'] },
		},
	};
	// view context drops the edit-only `raw`
	assert.match(ts(title, 'view'), /rendered: string;/);
	assert.doesNotMatch(ts(title, 'view'), /raw/);
	// edit context includes both
	assert.match(ts(title, 'edit'), /raw: string;/);
	assert.match(ts(title, 'edit'), /rendered: string;/);
});

test('oneOf / anyOf become unions', () => {
	assert.equal(
		ts({ oneOf: [{ type: 'string' }, { type: 'integer' }] }),
		'string | number'
	);
	assert.equal(
		ts({ anyOf: [{ type: 'boolean' }, { type: 'null' }] }),
		'boolean | null'
	);
});

test('untyped or unknown nodes fall back to unknown', () => {
	assert.equal(ts({}), 'unknown');
	assert.equal(ts({ type: 'something-weird' }), 'unknown');
});

test('property keys that are not valid identifiers are quoted', () => {
	const node: WPSchemaNode = {
		type: 'object',
		properties: { 'is-sticky': { type: 'boolean' } },
	};
	assert.match(ts(node), /"is-sticky": boolean;/);
});
