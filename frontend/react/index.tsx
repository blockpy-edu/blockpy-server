/**
 * react/index.tsx
 *
 * Central registration point for all React components.
 * Import this file from app.ts to ensure components are registered before
 * any page-level code calls mountReactComponent.
 *
 * When migrating a new component:
 *   1. Import it here.
 *   2. Call registerReactComponent('<ComponentName>', ComponentName).
 *   3. Update REACT_MIGRATION_PLAN.md.
 */
import React from 'react';
import { AlertBanner } from './components/AlertBanner';
import { registerReactComponent } from './mount';

// Cast through unknown because the registry holds components with different specific prop shapes.
// Individual components are still fully typed at their definition; only the mount bridge is loose.
registerReactComponent('AlertBanner', AlertBanner as unknown as React.ComponentType<Record<string, unknown>>);

export { mountReactComponent } from './mount';
