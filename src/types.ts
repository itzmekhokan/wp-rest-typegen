/**
 * The subset of JSON Schema that the WordPress REST API actually emits.
 *
 * WP uses a draft-04-flavoured schema with a few of its own conventions:
 *   - `context` controls which properties appear in `view` / `edit` / `embed`.
 *   - `readonly` marks response-only properties.
 *   - `type` may be a single string or an array (e.g. `["string", "null"]`).
 */
export interface WPSchemaNode {
	type?: string | string[];
	properties?: Record<string, WPSchemaNode>;
	items?: WPSchemaNode | WPSchemaNode[];
	enum?: unknown[];
	format?: string;
	context?: string[];
	readonly?: boolean;
	required?: string[] | boolean;
	additionalProperties?: boolean | WPSchemaNode;
	oneOf?: WPSchemaNode[];
	anyOf?: WPSchemaNode[];
	description?: string;
	default?: unknown;
	title?: string;
}

/** The envelope returned by an `OPTIONS` request to a REST route. */
export interface WPRouteOptions {
	namespace?: string;
	methods?: string[];
	schema?: WPSchemaNode;
}

/** A single resource ready to be rendered to TypeScript. */
export interface ResourceSchema {
	/** REST base, e.g. `posts`. Used as the registry key. */
	restBase: string;
	/** REST namespace, e.g. `wp/v2`. Disambiguates colliding bases. */
	namespace?: string;
	/** Interface name, derived from the schema `title`, e.g. `Post`. */
	name: string;
	schema: WPSchemaNode;
}

export type Context = 'view' | 'edit' | 'embed';

export interface GenerateOptions {
	/** Which context's property set to emit. Defaults to `view`. */
	context?: Context;
	/** Emit a `WPRestTypes` registry interface mapping rest_base -> type. */
	registry?: boolean;
	/** Header banner written at the top of the file. */
	banner?: string;
}
