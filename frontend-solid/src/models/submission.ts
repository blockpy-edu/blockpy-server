/**
 * Submission model
 */

export interface SubmissionJson {
  id: number;
  user_id: number;
  assignment_id: number;
  course_id: number;
  code?: string;
  correct?: boolean;
  score?: number;
}

export class Submission {
  private _id: number;
  private _userId: number;
  private _assignmentId: number;
  private _courseId: number;
  private _code?: string;
  private _correct?: boolean;
  private _score?: number;

  constructor(data: SubmissionJson) {
    this._id = data.id;
    this._userId = data.user_id;
    this._assignmentId = data.assignment_id;
    this._courseId = data.course_id;
    this._code = data.code;
    this._correct = data.correct;
    this._score = data.score;
  }

  id(): number { return this._id; }
  userId(): number { return this._userId; }
  assignmentId(): number { return this._assignmentId; }
  courseId(): number { return this._courseId; }
  code(): string | undefined { return this._code; }
  correct(): boolean | undefined { return this._correct; }
  score(): number | undefined { return this._score; }

  getAsSubmissionKey(): string {
    return `${this._courseId}-${this._assignmentId}-${this._userId}`;
  }

  fromJson(data: SubmissionJson): void {
    this._code = data.code;
    this._correct = data.correct;
    this._score = data.score;
  }
}
