/**
 * Incomplete Markdown Handler
 *
 * Provides "format-as-you-type" UX by:
 * 1. Tracking open markdown tags in a state stack
 * 2. Auto-closing incomplete tags for rendering
 * 3. Hiding markers that have no content yet
 *
 * Optimized for incremental updates during streaming.
 */
import type { IncompleteTagState } from './types';
export declare const INITIAL_INCOMPLETE_STATE: IncompleteTagState;
/**
 * Update tag state based on new text.
 * Only processes new characters since last update.
 *
 * @param state - Current state
 * @param fullText - Complete text (all tokens so far)
 * @returns Updated state
 */
export declare function updateTagState(state: IncompleteTagState, fullText: string): IncompleteTagState;
/**
 * Rebuild state from scratch using token-based scanning
 * This properly handles multi-character markers like ** and ```
 */
declare function rebuildTagState(fullText: string): IncompleteTagState;
/**
 * Fix incomplete markdown by auto-closing open tags.
 * This allows formatting to appear immediately during streaming.
 *
 * @param text - Raw markdown text
 * @param state - Current tag state
 * @returns Fixed markdown (ready for remark parsing)
 */
export declare function fixIncompleteMarkdown(text: string, state: IncompleteTagState): string;
/**
 * Hide incomplete markers that have no content yet.
 *
 * This is called AFTER auto-closing, so we hide auto-closed EMPTY tags.
 */
declare function hideIncompleteMarkers(text: string): string;
/**
 * Test-only exports
 */
export declare const __test__: {
    hideIncompleteMarkers: typeof hideIncompleteMarkers;
    rebuildTagState: typeof rebuildTagState;
};
export {};
//# sourceMappingURL=incomplete.d.ts.map