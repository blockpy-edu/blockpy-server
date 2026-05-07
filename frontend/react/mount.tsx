import React from 'react';
import { createRoot } from 'react-dom/client';
import { MountProps } from './types';

/**
 * A registry of React components that can be mounted by name.
 * Components are registered in react/index.tsx.
 */
const componentRegistry = new Map<string, React.ComponentType<MountProps>>();

/**
 * Register a React component under the given name so that it can be mounted
 * from server-rendered pages or legacy JS code.
 */
export function registerReactComponent(
    name: string,
    component: React.ComponentType<MountProps>
): void {
    if (componentRegistry.has(name)) {
        console.warn(`[React] Component "${name}" is already registered; overwriting.`);
    }
    componentRegistry.set(name, component);
}

/**
 * Mount a registered React component into the DOM element with the given ID.
 *
 * @param name     The component name as registered via registerReactComponent.
 * @param targetId The `id` attribute of the container element.
 * @param props    Props to pass to the component.
 *
 * @example
 *   // In a Jinja template or inline script:
 *   frontend.mountReactComponent('AlertBanner', 'my-alert-root', {
 *     message: 'Saved!',
 *     variant: 'success',
 *   });
 */
export function mountReactComponent(
    name: string,
    targetId: string,
    props: MountProps = {}
): void {
    const Component = componentRegistry.get(name);
    if (!Component) {
        console.error(`[React] No component registered with name "${name}".`);
        return;
    }

    const container = document.getElementById(targetId);
    if (!container) {
        console.error(`[React] Mount target element "#${targetId}" not found.`);
        return;
    }

    const root = createRoot(container);
    root.render(<Component {...props} />);
}
