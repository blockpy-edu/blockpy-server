/**
 * Quiz model - Core quiz state management using SolidJS
 */

import { createSignal, createMemo, Accessor, Setter } from 'solid-js';
import {
  QuizData,
  QuizMode,
  QuizFeedbackType,
  QuizSettings,
  Question,
  QuizSubmission,
  QuizSubmissionAttempt,
  FeedbackData
} from './types';

export class Quiz {
  private _instructions: QuizSettings;
  private _questions: Map<string, Question>;
  private _submission: QuizSubmission;
  private _assignmentId: number;
  private _courseId: number;
  private _userId: number;

  // Reactive state
  attempting: Accessor<boolean>;
  setAttempting: Setter<boolean>;
  
  attemptCount: Accessor<number>;
  setAttemptCount: Setter<number>;
  
  studentAnswers: Accessor<Record<string, any>>;
  setStudentAnswers: Setter<Record<string, any>>;
  
  feedback: Accessor<Record<string, FeedbackData>>;
  setFeedback: Setter<Record<string, FeedbackData>>;

  constructor(data: QuizData) {
    this._instructions = data.instructions.settings || {};
    this._questions = new Map(Object.entries(data.instructions.questions || {}));
    this._submission = data.submission;
    this._assignmentId = data.assignmentId;
    this._courseId = data.courseId;
    this._userId = data.userId;

    // Initialize reactive state
    const [attempting, setAttempting] = createSignal(
      data.submission.attempt?.attempting ?? false
    );
    this.attempting = attempting;
    this.setAttempting = setAttempting;

    const [attemptCount, setAttemptCount] = createSignal(
      data.submission.attempt?.count ?? 0
    );
    this.attemptCount = attemptCount;
    this.setAttemptCount = setAttemptCount;

    const [studentAnswers, setStudentAnswers] = createSignal(
      data.submission.studentAnswers || {}
    );
    this.studentAnswers = studentAnswers;
    this.setStudentAnswers = setStudentAnswers;

    const [feedback, setFeedback] = createSignal(
      data.submission.feedback || {}
    );
    this.feedback = feedback;
    this.setFeedback = setFeedback;
  }

  // Computed properties
  get attemptStatus(): QuizMode {
    if (this.attempting()) {
      return QuizMode.ATTEMPTING;
    } else if (this.attemptCount() > 0) {
      return QuizMode.COMPLETED;
    } else {
      return QuizMode.READY;
    }
  }

  get feedbackType(): QuizFeedbackType {
    return this._instructions.feedbackType ?? QuizFeedbackType.IMMEDIATE;
  }

  get attemptLimit(): number {
    return this._instructions.attemptLimit ?? -1;
  }

  get attemptsLeft(): string {
    const limit = this.attemptLimit;
    const count = this.attemptCount();
    
    if (limit === -1) {
      return `${count} attempt${count !== 1 ? 's' : ''} so far`;
    } else {
      const remaining = limit - count;
      if (remaining === 1) {
        return '1 attempt remaining';
      } else if (remaining === 0) {
        return 'no attempts remaining';
      } else {
        return `${remaining} attempts remaining`;
      }
    }
  }

  canAttempt(): boolean {
    const limit = this.attemptLimit;
    return limit === -1 || this.attemptCount() < limit;
  }

  getQuestions(): Question[] {
    return Array.from(this._questions.values());
  }

  getQuestion(id: string): Question | undefined {
    return this._questions.get(id);
  }

  // Actions
  startQuiz(): void {
    if (this.canAttempt()) {
      this.setAttempting(true);
      // Clear previous answers when starting a new attempt
      this.setStudentAnswers({});
      this.setFeedback({});
    }
  }

  submitAnswer(questionId: string, answer: any): void {
    const answers = { ...this.studentAnswers() };
    answers[questionId] = answer;
    this.setStudentAnswers(answers);
  }

  submitQuiz(): void {
    if (this.attempting()) {
      this.setAttempting(false);
      this.setAttemptCount(this.attemptCount() + 1);
      // Feedback would be calculated here or fetched from server
    }
  }

  // Serialization for API
  toSubmissionJSON(): QuizSubmission {
    return {
      studentAnswers: this.studentAnswers(),
      attempt: {
        attempting: this.attempting(),
        count: this.attemptCount(),
        mulligans: this._submission.attempt?.mulligans ?? 0
      },
      feedback: this.feedback()
    };
  }
}
