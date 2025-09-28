import * as ko from 'knockout';
import {Model, ModelJson} from "./model";
import {TwoWayReadonlyMap} from "../services/plugins";

export interface LogJson extends ModelJson {
    assignment_id: number | null;
    assignment_version: number;
    course_id: number | null;
    subject_id: number | null;
    event_type: string;
    file_path: string;
    category: string;
    label: string;
    message: string;
    client_timestamp: string;
    client_timezone: string;
}

export class Log extends Model<LogJson> {
    assignmentId: ko.Observable<number | null>;
    assignmentVersion: ko.Observable<number>;
    courseId: ko.Observable<number | null>;
    subjectId: ko.Observable<number | null>;
    eventType: ko.Observable<string>;
    filePath: ko.Observable<string>;
    category: ko.Observable<string>;
    label: ko.Observable<string>;
    message: ko.Observable<string>;
    clientTimestamp: ko.Observable<string>;
    clientTimezone: ko.Observable<string>;

    FIELDS: TwoWayReadonlyMap = new TwoWayReadonlyMap({
        "date_modified": "dateModified",
        "date_created": "dateCreated",
        "assignment_id": "assignmentId",
        "assignment_version": "assignmentVersion",
        "course_id": "courseId",
        "subject_id": "subjectId",
        "event_type": "eventType",
        "file_path": "filePath",
        "category": "category",
        "label": "label",
        "message": "message",
        "client_timestamp": "clientTimestamp",
        "client_timezone": "clientTimezone"
    });

    constructor(data: LogJson) {
        super(data);
        this.koFromJson(data);
    }

    getAsSubmissionKey() {
        return [this.courseId(), this.subjectId(), this.assignmentId()].join(",");
    }

    isEditEvent() {
        return (this.eventType() === "File.Edit" || this.eventType() === "File.Create");
    }

    when() {
        return this.clientTimestamp() || this.dateCreated();
    }
}

// TODO: Finish processing all event types
export const REMAP_EVENT_TYPES: Record<string, string> = {
    "Session.Start": "Began session",
    "X-IP.Change": "Changed IP address",
    "File.Edit": "Edited code",
    "File.Create": "Created submission",
    "Run.Program": "Ran program",
    "Compile.Error": "Syntax error",
    "X-Submission.LMS": "Updated grade",
    "start_timer": "Started timer",
    "X-View.Submission": "Viewed submission",
    "X-Quiz.Grade.Failure": "Failed while grading quiz",
    "error": "System Error",
    "extend_time": "Instructor Extended Time Limit",
    "timer_expired": "Timer Expired (Exam Locked)"
};