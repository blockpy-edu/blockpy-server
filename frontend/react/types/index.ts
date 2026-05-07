/**
 * Shared TypeScript interfaces used across React components.
 * Add new API response shapes and domain types here as components are migrated.
 */

/** Minimal shape returned by all success/error JSON responses from the server. */
export interface ApiResponse {
    success: boolean;
    message?: string;
}

/** Severity variants for the AlertBanner component. */
export type AlertVariant = 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'secondary';

/** Props passed to a React component registered with mountReactComponent. */
export type MountProps = Record<string, unknown>;
