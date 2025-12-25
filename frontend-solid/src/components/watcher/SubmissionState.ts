/**
 * Submission State - represents the state of a submission at a point in time
 */

import { Log, REMAP_EVENT_TYPES } from '../../models/log';
import { formatDuration, prettyPrintDateTimeString } from '../../utilities/dates';

export enum WatchMode {
  SUMMARY = 'SUMMARY',
  FULL = 'FULL'
}

export enum FeedbackMode {
  FEEDBACK = 'Feedback',
  SYSTEM = 'System',
  BOTH = 'Both',
  HIDE = 'Hidden'
}

export class SubmissionState {
  loaded: boolean = false;
  friendly: string = '';
  code: string = '';
  feedback: string = '';
  system: string = '';
  lastRan: string | null = null;
  lastEdit: string | null = null;
  lastOpened: string | null = null;
  completed: boolean = false;
  score: number = 0;
  mode: string = 'unknown';
  fullscreen: boolean = false;
  log: Log | null = null;

  constructor(current: SubmissionState | null, log: Log) {
    this.makeNextState(current, log);
  }

  getPrettyTime(): string {
    if (!this.log) return '';
    return prettyPrintDateTimeString(this.log.when());
  }

  getPrettyLastEdit(watchMode?: WatchMode): string {
    const current = watchMode !== WatchMode.SUMMARY && this.log ? this.log.when() : null;
    return formatDuration(this.lastEdit, current);
  }

  getPrettyLastRan(watchMode?: WatchMode): string {
    const current = watchMode !== WatchMode.SUMMARY && this.log ? this.log.when() : null;
    return formatDuration(this.lastRan, current);
  }

  getPrettyLastOpened(watchMode?: WatchMode): string {
    const current = watchMode !== WatchMode.SUMMARY && this.log ? this.log.when() : null;
    return formatDuration(this.lastOpened, current);
  }

  copyState(other: SubmissionState | null) {
    if (other === null) {
      this.code = "";
      this.friendly = "Not Loaded";
      this.feedback = "Not yet executed";
      this.system = "";
      this.lastRan = null;
      this.lastEdit = null;
      this.lastOpened = null;
      this.completed = false;
      this.score = 0;
      this.mode = "unknown";
      this.fullscreen = false;
      this.log = null;
    } else {
      this.code = other.code;
      this.feedback = other.feedback;
      this.system = other.system;
      this.lastRan = other.lastRan;
      this.lastEdit = other.lastEdit;
      this.lastOpened = other.lastOpened;
      this.completed = other.completed;
      this.score = other.score;
      this.mode = other.mode;
      this.fullscreen = other.fullscreen;
      this.log = null;
    }
  }

  makeNextState(current: SubmissionState | null, log: Log) {
    this.copyState(current);
    this.log = log;
    this.friendly = REMAP_EVENT_TYPES[log.eventType()] || log.eventType();

    switch (log.eventType()) {
      case "File.Create":
        this.code = log.message();
        this.lastEdit = log.when();
        break;
      case "File.Edit":
        this.code = log.message();
        this.lastEdit = log.when();
        this.system = "<strong>Edited code</strong>";
        break;
      case "Session.Start":
        this.lastOpened = log.when();
        this.system = `<strong>New Session</strong>`;
        break;
      case "Compile":
        this.system = `<strong>Compiling</strong>`;
        break;
      case "Run.Program":
        this.lastRan = log.when();
        let message = "";
        if (log.category() === "ProgramErrorOutput") {
          message = `<strong>Runtime Error</strong><div>${log.message()}</div>`;
        } else {
          try {
            const data = JSON.parse(log.message());
            if ("output" in data) {
              const output = JSON.parse(data['output']);
              const outputBody = output.map((line: any) => 
                `<code>${line.type}: ${line.contents}</code>`
              ).join("\n");
              message += "<strong>Execution Output:</strong><pre>" + outputBody + "</pre>";
            }
            if ("errors" in data) {
              const errors = JSON.parse(data['errors']);
              const errorBody = errors.map((error: any) => `<code>${error}</code>`).join("\n");
              message += "<strong>Execution Errors:</strong><pre>" + errorBody + "</pre>";
            }
            message += `<strong>Run Details</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
          } catch (e) {
            console.error(e);
            message = `<strong>Run Details</strong><pre>${log.message()}</pre>`;
          }
        }
        this.system = `${message}`;
        break;
      case "Compile.Error":
        this.system = `<strong>Compiler Error</strong><div>${log.message()}</div>`;
        break;
      case "Intervention":
        this.completed = this.completed || log.category() === "Complete";
        this.feedback = `<strong>${log.label()}</strong><div>${log.message()}</div>`;
        break;
      case "X-View.Change":
        this.mode = log.message();
        this.system = `<strong>Changed Editing Mode</strong><div>${this.mode}</div>`;
        break;
      case "X-Submission.LMS":
        this.score = parseInt(log.message(), 10);
        this.system = `<strong>Submitted Score</strong><div>${this.score}</div>`;
        break;
    }
  }
}
