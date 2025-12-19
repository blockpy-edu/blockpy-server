/**
 * Main entry point for SolidJS frontend
 */

import { render } from 'solid-js/web';
import { Watcher } from './components/watcher/Watcher';
import { WatchMode } from './components/watcher/SubmissionState';

// Export components for external use
export { Watcher } from './components/watcher/Watcher';
export { SubmissionHistory } from './components/watcher/SubmissionHistory';
export { WatchMode, FeedbackMode } from './components/watcher/SubmissionState';

// Export models
export { User } from './models/user';
export { Assignment } from './models/assignment';
export { Log } from './models/log';
export { Submission } from './models/submission';

// Export utilities
export * from './utilities/dates';
export { ajax_post, ajax_get } from './services/ajax';

/**
 * Initialize a Watcher component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the Watcher component
 */
export function initWatcher(
  container: HTMLElement | string,
  props: {
    courseId: number;
    assignmentIds?: string;
    userIds?: string;
    defaultWatchMode?: WatchMode;
  }
) {
  const element = typeof container === 'string' 
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <Watcher {...props} />, element);
}

// Make it available globally for template usage
if (typeof window !== 'undefined') {
  (window as any).frontendSolid = {
    initWatcher,
    Watcher,
    WatchMode,
  };
}
