/**
 * StableBlock Renderer
 *
 * Renders completed, immutable blocks using cached AST.
 * Memoized to prevent re-renders — once a block is stable, it never changes.
 */
import React from 'react';
import type { StableBlock as StableBlockType, ThemeConfig, ComponentRegistry } from '../core/types';
interface StableBlockProps {
    block: StableBlockType;
    theme: ThemeConfig;
    componentRegistry?: ComponentRegistry;
}
/**
 * StableBlock component — renders finalized blocks from cached AST.
 *
 * Uses React.memo with contentHash comparison for efficient updates.
 * The block prop is immutable — once finalized, content never changes.
 */
export declare const StableBlock: React.FC<StableBlockProps>;
export {};
//# sourceMappingURL=StableBlock.d.ts.map