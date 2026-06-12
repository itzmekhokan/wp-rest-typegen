import { strict as assert } from 'node:assert';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const FIXTURE = fileURLToPath(new URL('../fixtures/post-schema.json', import.meta.url));

/** Run the CLI as a real subprocess and capture stdout. */
async function cli(args: string[]) {
	const { stdout } = await run('node', [CLI, ...args], { encoding: 'utf8' });
	return stdout;
}

test('generates a registry by default', async () => {
	const out = await cli(['--input', FIXTURE]);
	assert.match(out, /export interface Post \{/);
	assert.match(out, /export interface WPRestTypes \{/);
});

test('--no-registry suppresses the registry (regression: parseArgs negation)', async () => {
	const out = await cli(['--input', FIXTURE, '--no-registry']);
	assert.match(out, /export interface Post \{/);
	assert.doesNotMatch(out, /WPRestTypes/);
});

test('--context edit includes edit-only fields', async () => {
	const view = await cli(['--input', FIXTURE, '--context', 'view']);
	const edit = await cli(['--input', FIXTURE, '--context', 'edit']);
	assert.doesNotMatch(view, /raw: string/);
	assert.match(edit, /raw: string;/);
});

test('--help prints usage and exits 0', async () => {
	const out = await cli(['--help']);
	assert.match(out, /generate TypeScript types from a WordPress REST API/);
});
