/**
 * Log model for tracking student events
 */

export interface LogJson {
  id: number;
  event_type: string;
  message: string;
  category: string;
  label: string;
  when: string;
  subject_id: number;
  assignment_id: number;
  course_id: number;
  client_timestamp?: string;
  date_created?: string;
}

export const REMAP_EVENT_TYPES: Record<string, string> = {
  "File.Create": "Created File",
  "File.Edit": "Edited Code",
  "Session.Start": "Started Session",
  "Compile": "Compiled",
  "Run.Program": "Ran Program",
  "Compile.Error": "Compilation Error",
  "Intervention": "Feedback",
  "X-View.Change": "Changed View",
  "X-Submission.LMS": "Submitted to LMS",
};

export class Log {
  id: number;
  private _eventType: string;
  private _message: string;
  private _category: string;
  private _label: string;
  private _when: string;
  private _subjectId: number;
  private _assignmentId: number;
  private _courseId: number;
  private _clientTimestamp?: string;
  private _dateCreated?: string;

  constructor(data: LogJson) {
    this.id = data.id;
    this._eventType = data.event_type;
    this._message = data.message;
    this._category = data.category;
    this._label = data.label;
    this._when = data.when;
    this._subjectId = data.subject_id;
    this._assignmentId = data.assignment_id;
    this._courseId = data.course_id;
    this._clientTimestamp = data.client_timestamp;
    this._dateCreated = data.date_created;
  }

  eventType(): string { return this._eventType; }
  message(): string { return this._message; }
  category(): string { return this._category; }
  label(): string { return this._label; }
  when(): string { return this._when; }
  subjectId(): number { return this._subjectId; }
  assignmentId(): number { return this._assignmentId; }
  courseId(): number { return this._courseId; }
  clientTimestamp(): string | undefined { return this._clientTimestamp; }
  dateCreated(): string | undefined { return this._dateCreated; }

  isEditEvent(): boolean {
    return this._eventType === "File.Edit";
  }

  getAsSubmissionKey(): string {
    return `${this._courseId}-${this._assignmentId}-${this._subjectId}`;
  }
}
