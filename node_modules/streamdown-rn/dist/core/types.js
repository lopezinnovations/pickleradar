/**
 * Core Types for Streamdown-RN
 *
 * Block-based streaming markdown architecture.
 * Optimized for append-only AI response streams.
 */
/**
 * Initial empty registry state
 * Note: activeTagState is set to a literal to avoid circular dependency
 */
export const INITIAL_REGISTRY = {
    blocks: [],
    activeBlock: null,
    activeTagState: {
        stack: [],
        tagCounts: {},
        previousTextLength: 0,
        earliestPosition: 0,
        inCodeBlock: false,
        inInlineCode: false,
    },
    cursor: 0,
    blockCounter: 0,
};
// ============================================================================
// Utilities
// ============================================================================
/**
 * Fast hash function (djb2) for content comparison.
 * Used in React.memo to avoid deep equality checks.
 */
export function hashContent(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    }
    return hash >>> 0; // Ensure unsigned
}
/**
 * Generate a unique block ID
 */
export function generateBlockId(type, counter) {
    const prefix = type === 'heading' ? 'h' :
        type === 'paragraph' ? 'p' :
            type === 'codeBlock' ? 'c' :
                type === 'list' ? 'l' :
                    type === 'table' ? 't' :
                        type === 'blockquote' ? 'q' :
                            type === 'horizontalRule' ? 'hr' :
                                type === 'image' ? 'img' :
                                    type === 'component' ? 'cmp' : 'b';
    return `${prefix}-${counter}`;
}
//# sourceMappingURL=types.js.map