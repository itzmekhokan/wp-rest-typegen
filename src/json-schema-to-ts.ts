import type { Context, WPSchemaNode } from './types.ts';

/** Turn a schema `title` like `wp_block` into a PascalCase name like `WpBlock`. */
export function pascalCase(input: string): string {
	return input
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join('');
}

/** Quote a JSON value as a TS literal type. */
function literal(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	// Objects/arrays in an enum are rare; fall back to the structural type.
	return 'unknown';
}

function normalizeTypes(type: WPSchemaNode['type']): string[] {
	if (!type) return [];
	return Array.isArray(type) ? type : [type];
}

/** Should a property be emitted for the requested context? */
function visibleIn(node: WPSchemaNode, context: Context): boolean {
	// No `context` array means "always present".
	if (!node.context || node.context.length === 0) return true;
	return node.context.includes(context);
}

export interface RenderState {
	context: Context;
	indent: string;
}

/** Render an object's `properties` as an inline TS object type, honouring context. */
function renderObject(node: WPSchemaNode, state: RenderState): string {
	const props = node.properties ?? {};
	const keys = Object.keys(props).filter((key) => visibleIn(props[key], state.context));

	if (keys.length === 0) {
		// Open-ended object (e.g. `meta` with no registered fields).
		if (node.additionalProperties && typeof node.additionalProperties === 'object') {
			return `Record<string, ${nodeToType(node.additionalProperties, state)}>`;
		}
		if (node.additionalProperties === false) return 'Record<string, never>';
		return 'Record<string, unknown>';
	}

	const inner = state.indent + '\t';
	const lines: string[] = ['{'];
	for (const key of keys) {
		const child = props[key];
		const childState: RenderState = { ...state, indent: inner };
		const optional = child.readonly === false ? '?' : '';
		if (child.description) {
			lines.push(`${inner}/** ${child.description.replace(/\*\//g, '*\\/')} */`);
		}
		const safeKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
		lines.push(`${inner}${safeKey}${optional}: ${nodeToType(child, childState)};`);
	}
	lines.push(`${state.indent}}`);
	return lines.join('\n');
}

/** Core recursive converter: one JSON Schema node -> one TS type expression. */
export function nodeToType(node: WPSchemaNode, state: RenderState): string {
	if (node.oneOf?.length) {
		return node.oneOf.map((sub) => nodeToType(sub, state)).join(' | ');
	}
	if (node.anyOf?.length) {
		return node.anyOf.map((sub) => nodeToType(sub, state)).join(' | ');
	}
	if (node.enum?.length) {
		const union = Array.from(new Set(node.enum.map(literal))).join(' | ');
		return union || 'unknown';
	}

	const types = normalizeTypes(node.type);
	if (types.length === 0) {
		// Untyped node: infer from shape.
		if (node.properties || node.additionalProperties !== undefined) {
			return renderObject(node, state);
		}
		return 'unknown';
	}

	const parts = types.map((t) => {
		switch (t) {
			case 'integer':
			case 'number':
				return 'number';
			case 'string':
				return 'string';
			case 'boolean':
				return 'boolean';
			case 'null':
				return 'null';
			case 'array': {
				const items = Array.isArray(node.items) ? node.items[0] : node.items;
				const itemType = items ? nodeToType(items, state) : 'unknown';
				// Wrap unions so `(a | b)[]` parses correctly.
				return /[|&]/.test(itemType) ? `(${itemType})[]` : `${itemType}[]`;
			}
			case 'object':
				return renderObject(node, state);
			default:
				return 'unknown';
		}
	});

	return Array.from(new Set(parts)).join(' | ');
}
