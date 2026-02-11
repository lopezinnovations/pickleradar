/**
 * ActiveBlock Renderer
 *
 * Renders the currently streaming block with format-as-you-type UX.
 *
 * Flow:
 * 1. Fix incomplete markdown tags (auto-close for preview)
 * 2. Parse with remark to get AST
 * 3. Render AST with ASTRenderer
 */
import React from 'react';
import type { ActiveBlock as ActiveBlockType, ThemeConfig, ComponentRegistry, IncompleteTagState } from '../core/types';
interface ActiveBlockProps {
    block: ActiveBlockType | null;
    tagState: IncompleteTagState;
    theme: ThemeConfig;
    componentRegistry?: ComponentRegistry;
}
/**
 * ActiveBlock component — renders the currently streaming block.
 *
 * This component INTENTIONALLY re-renders on each token.
 * It applies "format-as-you-type" by auto-closing incomplete tags.
 */
export declare const ActiveBlock: React.FC<ActiveBlockProps>;
export {};
//# sourceMappingURL=ActiveBlock.d.ts.map