/**
 * AST Renderer
 *
 * THE single source of truth for rendering MDAST nodes to React Native.
 * Handles all GitHub Flavored Markdown via remark-gfm.
 *
 * Includes:
 * - All block-level nodes (paragraph, heading, code, blockquote, list, table, hr, image)
 * - All inline nodes (text, strong, emphasis, delete, code, link, break)
 * - Custom component injection via [{c:"Name",p:{...}}] syntax
 * - Syntax highlighting for code blocks
 */
import React, { ReactNode } from 'react';
import type { Content } from 'mdast';
import type { ThemeConfig, ComponentRegistry, StableBlock } from '../core/types';
import { extractComponentData, type ComponentData } from '../core/componentParser';
export { extractComponentData, type ComponentData };
export interface ASTRendererProps {
    /** MDAST node to render */
    node: Content;
    /** Theme configuration */
    theme: ThemeConfig;
    /** Component registry for custom components */
    componentRegistry?: ComponentRegistry;
    /** Whether this is streaming (for components) */
    isStreaming?: boolean;
}
/**
 * Main AST Renderer Component
 *
 * Renders a single MDAST node and its children recursively.
 */
export declare const ASTRenderer: React.FC<ASTRendererProps>;
export interface ComponentBlockProps {
    theme: ThemeConfig;
    componentRegistry?: ComponentRegistry;
    /** StableBlock input */
    block?: StableBlock;
    /** Direct component name (when not using block) */
    componentName?: string;
    /** Direct props (when not using block) */
    props?: Record<string, unknown>;
    /** CSS Grid-like style for layout positioning */
    style?: Record<string, unknown>;
    /** Direct children (when not using block) */
    children?: ComponentData[];
    /** Whether streaming (for active blocks) */
    isStreaming?: boolean;
}
/**
 * Render a block-level custom component with skeleton and children support.
 */
export declare const ComponentBlock: React.FC<ComponentBlockProps>;
/**
 * Render a complete MDAST tree (for testing)
 */
export declare function renderAST(nodes: Content[], theme: ThemeConfig, componentRegistry?: ComponentRegistry, isStreaming?: boolean): ReactNode;
//# sourceMappingURL=ASTRenderer.d.ts.map