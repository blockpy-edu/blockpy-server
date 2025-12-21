/**
 * Quiz types and enums for SolidJS implementation
 */

export enum QuizMode {
  ATTEMPTING = "ATTEMPTING",
  COMPLETED = "COMPLETED",
  READY = "READY"
}

export enum QuizFeedbackType {
  IMMEDIATE = "IMMEDIATE",
  NONE = "NONE",
  SUMMARY = "SUMMARY"
}

export enum QuizPoolRandomness {
  ATTEMPT = "ATTEMPT",
  SEED = "SEED",
  NONE = "NONE",
  GROUP = "GROUP"
}

export enum QuizQuestionType {
  multiple_choice_question = "multiple_choice_question",
  multiple_answers_question = "multiple_answers_question",
  true_false_question = "true_false_question",
  text_only_question = "text_only_question",
  matching_question = "matching_question",
  multiple_dropdowns_question = "multiple_dropdowns_question",
  short_answer_question = "short_answer_question",
  fill_in_multiple_blanks_question = "fill_in_multiple_blanks_question",
  calculated_question = "calculated_question",
  essay_question = "essay_question",
  file_upload_question = "file_upload_question",
  numerical_question = "numerical_question"
}

export interface QuestionPool {
  questions: string[];
  amount: number;
  name: string;
  group?: string;
}

export interface QuizSettings {
  /** How many times you can attempt a quiz; -1 is infinite attempts */
  attemptLimit?: number;
  /** How many minutes you must wait between attempts; -1 is no minutes */
  coolDown?: number;
  /** What type of feedback this is **/
  feedbackType?: QuizFeedbackType;
  /** How many questions to show on each "page"; -1 is all questions on one page */
  questionsPerPage?: number;
  /** What to use when choose the pool, for consistency */
  poolRandomness?: QuizPoolRandomness;
  /** The URL or ID of the reading to use as preamble, if there is one */
  readingId?: number | null;
}

export interface QuestionBase {
  id: string;
  type: QuizQuestionType;
  body: string;
  points?: number;
  retainOrder?: boolean;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: QuizQuestionType.multiple_choice_question;
  answers: string[];
}

export interface TrueFalseQuestion extends QuestionBase {
  type: QuizQuestionType.true_false_question;
}

export interface ShortAnswerQuestion extends QuestionBase {
  type: QuizQuestionType.short_answer_question;
}

export interface MultipleAnswersQuestion extends QuestionBase {
  type: QuizQuestionType.multiple_answers_question;
  answers: string[];
}

export type Question =
  | MultipleChoiceQuestion
  | TrueFalseQuestion
  | ShortAnswerQuestion
  | MultipleAnswersQuestion;

export interface QuizInstructions {
  questions?: Record<string, Question>;
  settings?: QuizSettings;
  pools?: QuestionPool[];
}

export interface QuizSubmissionAttempt {
  attempting?: boolean;
  count?: number;
  /** Number of times the instructor has given extra attempts **/
  mulligans?: number;
}

export interface FeedbackData {
  correct: boolean;
  message?: string;
  score?: number;
}

export interface QuizSubmission {
  studentAnswers?: Record<string, any>;
  attempt?: QuizSubmissionAttempt;
  feedback?: Record<string, FeedbackData>;
}

export interface QuizData {
  instructions: QuizInstructions;
  submission: QuizSubmission;
  assignmentId: number;
  courseId: number;
  userId: number;
}
