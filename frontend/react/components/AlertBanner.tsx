import React, { useState } from 'react';
import { AlertVariant } from '../types';

export interface AlertBannerProps {
    /** Message text to display. */
    message: string;
    /** Bootstrap contextual variant (default: 'info'). */
    variant?: AlertVariant;
    /** Whether the user can dismiss this banner (default: true). */
    dismissible?: boolean;
}

/**
 * AlertBanner – a simple Bootstrap-styled alert that can be mounted into any
 * server-rendered page via `frontend.mountReactComponent`.
 *
 * Example (from a template or inline script):
 *   frontend.mountReactComponent('AlertBanner', 'my-alert-container', {
 *     message: 'Your work has been saved.',
 *     variant: 'success',
 *   });
 */
export function AlertBanner({ message, variant = 'info', dismissible = true }: AlertBannerProps) {
    const [visible, setVisible] = useState(true);

    if (!visible) {
        return null;
    }

    return (
        <div
            className={`alert alert-${variant}${dismissible ? ' alert-dismissible' : ''} fade show`}
            role="alert"
        >
            {message}
            {dismissible && (
                <button
                    type="button"
                    className="close"
                    aria-label="Close"
                    onClick={() => setVisible(false)}
                >
                    <span aria-hidden="true">&times;</span>
                </button>
            )}
        </div>
    );
}
