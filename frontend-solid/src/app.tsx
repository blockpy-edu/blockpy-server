/**
 * Main entry point for SolidJS frontend
 */

import { render } from 'solid-js/web';
import { Watcher } from './components/watcher/Watcher';
import { Quizzer } from './components/quizzes/Quizzer';
import { QuizEditor } from './components/quizzes/QuizEditor';
import { Reader, ReaderProps } from './components/reader/Reader';
import { Textbook, TextbookProps, TextbookData } from './components/textbook/Textbook';
import { WatchMode } from './components/watcher/SubmissionState';
import { QuizData } from './components/quizzes/types';
import { AssignmentManager } from './components/management/AssignmentManager';
import { CourseList, type Course } from './components/management/CourseList';
import { GroupList } from './components/management/GroupList';
import { ModelSelector, type Model } from './components/management/ModelSelector';
import { UserEditor } from './components/management/UserEditor';

// Export components for external use
export { Watcher } from './components/watcher/Watcher';
export { SubmissionHistory } from './components/watcher/SubmissionHistory';
export { WatchMode, FeedbackMode } from './components/watcher/SubmissionState';

// Export quiz components
export { Quizzer } from './components/quizzes/Quizzer';
export { QuizEditor } from './components/quizzes/QuizEditor';
export type { QuizData } from './components/quizzes/types';
export {
  QuizMode,
  QuizFeedbackType,
  QuizQuestionType
} from './components/quizzes/types';

// Export reader and textbook components
export { Reader } from './components/reader/Reader';
export type { ReaderProps } from './components/reader/Reader';
export { Textbook } from './components/textbook/Textbook';
export type { TextbookProps, TextbookData } from './components/textbook/Textbook';

// Export management components
export { AssignmentManager } from './components/management/AssignmentManager';
export { CourseList } from './components/management/CourseList';
export type { Course } from './components/management/CourseList';
export { GroupList } from './components/management/GroupList';
export { ModelSelector } from './components/management/ModelSelector';
export type { Model } from './components/management/ModelSelector';
export { UserEditor, SortOrder, RenderStyle } from './components/management/UserEditor';

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

/**
 * Initialize a Quizzer component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param quizData - Quiz data including instructions and submission
 * @param isInstructor - Whether the user is an instructor
 */
export function initQuizzer(
  container: HTMLElement | string,
  quizData: QuizData,
  isInstructor: boolean = false
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <Quizzer quizData={quizData} isInstructor={isInstructor} />, element);
}

/**
 * Initialize a QuizEditor component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param quizData - Quiz data including instructions and submission
 * @param onSave - Callback when quiz is saved
 */
export function initQuizEditor(
  container: HTMLElement | string,
  quizData: QuizData,
  onSave?: (data: QuizData) => void
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <QuizEditor quizData={quizData} onSave={onSave} />, element);
}

/**
 * Initialize a Reader component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the Reader component
 */
export function initReader(
  container: HTMLElement | string,
  props: ReaderProps
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <Reader {...props} />, element);
}

/**
 * Initialize a Textbook component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the Textbook component
 */
export function initTextbook(
  container: HTMLElement | string,
  props: TextbookProps
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <Textbook {...props} />, element);
}

/**
 * Initialize an AssignmentManager component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the AssignmentManager component
 */
export function initAssignmentManager(
  container: HTMLElement | string,
  props: { courseId: number; user: any }
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <AssignmentManager {...props} />, element);
}

/**
 * Initialize a CourseList component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the CourseList component
 */
export function initCourseList(
  container: HTMLElement | string,
  props: { courses: Course[]; user: any; label: string }
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <CourseList {...props} />, element);
}

/**
 * Initialize a GroupList component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the GroupList component
 */
export function initGroupList(
  container: HTMLElement | string,
  props: { courseId: number }
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <GroupList {...props} />, element);
}

/**
 * Initialize a ModelSelector component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the ModelSelector component
 */
export function initModelSelector(
  container: HTMLElement | string,
  props: { models: Model[]; label: string; storageKey?: string }
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  const SelectorComponent = ModelSelector(props);
  render(() => <SelectorComponent />, element);
}

/**
 * Initialize a UserEditor component in the given container
 * @param container - DOM element or selector where the component should be mounted
 * @param props - Props for the UserEditor component
 */
export function initUserEditor(
  container: HTMLElement | string,
  props?: any
) {
  const element = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!element) {
    console.error('Container element not found:', container);
    return;
  }

  render(() => <UserEditor {...(props || {})} />, element);
}

// Make it available globally for template usage
if (typeof window !== 'undefined') {
  (window as any).frontendSolid = {
    initWatcher,
    initQuizzer,
    initQuizEditor,
    initReader,
    initTextbook,
    initAssignmentManager,
    initCourseList,
    initGroupList,
    initModelSelector,
    initUserEditor,
    Watcher,
    Quizzer,
    QuizEditor,
    Reader,
    Textbook,
    AssignmentManager,
    CourseList,
    GroupList,
    ModelSelector,
    UserEditor,
    WatchMode,
  };
}

