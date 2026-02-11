/**
 * Component Parser
 *
 * Pure logic for parsing [{c:...}] component syntax.
 * No React dependencies - safe for testing.
 */
/**
 * Component data extracted from DSL syntax
 */
export interface ComponentData {
    name: string;
    props: Record<string, unknown>;
    /** CSS Grid-like style for layout (gridColumn, gridRow, etc.) */
    style?: Record<string, unknown>;
    children?: ComponentData[];
}
/**
 * Try to repair and parse incomplete JSON by closing open braces/brackets.
 * Now also handles partial string values for progressive prop rendering.
 */
export declare function tryParseIncompleteJSON(json: string): unknown | null;
/**
 * Recursively extract children from nested component arrays (complete JSON).
 * Props are sanitized to prevent XSS via malicious URLs.
 */
export declare function extractChildrenRecursive(children: unknown[]): ComponentData[];
/**
 * Extract component data from DSL syntax.
 * Supports: [{c:"Name",p:{...},children:[...]}]
 *
 * Works for both complete and streaming (partial) content.
 * Props are sanitized to prevent XSS via malicious URLs.
 */
export declare function extractComponentData(content: string): ComponentData;
//# sourceMappingURL=componentParser.d.ts.map