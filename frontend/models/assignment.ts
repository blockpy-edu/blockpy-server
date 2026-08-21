import * as ko from 'knockout';
import {Model, ModelJson, ModelStore} from "./model";
import {capitalize, naturalCompare, TwoWayReadonlyMap} from "../services/plugins";
import {ajax_get} from "../services/ajax";
import {AssignmentGroup, AssignmentGroupJson} from "./assignment_group";

export interface AssignmentJson extends ModelJson {
    id: number;
    name: string;
    url: string;

    type: string;
    instructions: string;
    reviewed: boolean;
    hidden: boolean;
    public: boolean;
    subordinate: boolean;
    ip_ranges: string;
    points: number;
    settings: string;

    on_run: string;
    on_change: string;
    on_eval: string;
    starting_code: string;
    extra_instructor_files: string;
    extra_starting_files: string;

    forked_id: number;
    forked_version: number;
    owner_id: number;
    course_id: number;
    version: number;
}

export class Assignment extends Model<AssignmentJson> {
    id: number;
    name: KnockoutObservable<string>;
    url: KnockoutObservable<string>;
    type: KnockoutObservable<string>;
    instructions: KnockoutObservable<string>;
    reviewed: KnockoutObservable<boolean>;
    hidden: KnockoutObservable<boolean>;
    public: KnockoutObservable<boolean>;
    subordinate: KnockoutObservable<boolean>;
    ipRanges: KnockoutObservable<string>;
    settings: KnockoutObservable<string>;
    points: KnockoutObservable<number>;
    onRun: KnockoutObservable<string>;
    onChange: KnockoutObservable<string>;
    onEval: KnockoutObservable<string>;
    startingCode: KnockoutObservable<string>;
    extraInstructorFiles: KnockoutObservable<string>;
    extraStartingFiles: KnockoutObservable<string>;
    forkedId: KnockoutObservable<number>;
    forkedVersion: KnockoutObservable<number>;
    ownerId: KnockoutObservable<number>;
    courseId: KnockoutObservable<number>;
    version: KnockoutObservable<number>;

    title: KnockoutReadonlyComputed<string>;
    editUrl: KnockoutReadonlyComputed<string>;
    group: KnockoutObservable<AssignmentGroup|null>;

    FIELDS: TwoWayReadonlyMap = new TwoWayReadonlyMap({
        "name": "name",
        "url": "url",
        "type": "type",
        "instructions": "instructions",
        "reviewed": "reviewed",
        "hidden": "hidden",
        "public": "public",
        "subordinate": "subordinate",
        "ip_ranges": "ipRanges",
        "points": "points",
        "settings": "settings",
        "on_run": "onRun",
        "on_change": "onChange",
        "on_eval": "onEval",
        "starting_code": "startingCode",
        "extra_instructor_files": "extraInstructorFiles",
        "extra_starting_files": "extraStartingFiles",
        "forked_id": "forkedId",
        "forked_version": "forkedVersion",
        "owner_id": "ownerId",
        "course_id": "courseId",
        "version": "version",
        "date_modified": "dateModified",
        "date_created": "dateCreated"
    });

    constructor(data: AssignmentJson) {
        super(data);
        this.group = ko.observable<AssignmentGroup>(null);
        this.koFromJson(data);
        this.title = ko.pureComputed<string>(() => {
            if (this.type().toLowerCase() === "maze") {
                return "Maze "+this.name();
            } else {
                return this.name();
            }
        }, this);
        this.editUrl = ko.pureComputed<string>(() => {
            if (this.type() === "reading") {
                return window["$URL_ROOT"]+"/assignments/reading/" + (
                    this.url() ? this.url() : this.id) + "?";
            } else {
                return window["$URL_ROOT"]+"/assignments/load/" + (
                    this.url() ? `?assignment_url=${this.url()}`
                        : `?assignment_id=${this.id}`);
            }
        }, this);
    }
}

/** Natural (group name, assignment title) ordering, with ungrouped assignments
 * forced to the end -- the same order the server's natsorted listings use. */
export function compareAssignmentsByGroup(left: Assignment, right: Assignment): number {
    const leftGroup = left.group() != null ? left.group().name() : null;
    const rightGroup = right.group() != null ? right.group().name() : null;
    if ((leftGroup == null) !== (rightGroup == null)) {
        return leftGroup == null ? 1 : -1;
    }
    return naturalCompare(leftGroup || "", rightGroup || "") || naturalCompare(left.title(), right.title());
}

export class AssignmentStore extends ModelStore<AssignmentJson, Assignment> {
    GET_FIELD: string = "assignments";

    getIdByUrl(url: string): Promise<number> {
        return new Promise((resolve, reject) => {
            const target = Object.values(this.data).find((potential: Assignment) => potential.url() === url);
            if (target !== undefined) {
                resolve(target.id);
            } else {
                this.getByUrl(url).then((assignment: Assignment)=> resolve(assignment.id)).catch(reject);
            }
        });
    }

    getPayload(): any {
        return {
            assignment_ids: this.getDelayedIds().join(","),
            course_id: this.courseId
        };
    }

    getUrl(): string {
        return "assignments/get_ids";
    }

    makeEmptyInstance(id: number): Assignment {
        return new Assignment({
            id: id,
            date_created: null,
            date_modified: null,
            name: "Unknown",
            url: "",
            type: "unknown",
            instructions: "",
            reviewed: false,
            hidden: false,
            public: false,
            subordinate: false,
            ip_ranges: "",
            points: 1,
            settings: "",
            on_run: "",
            on_change: "",
            on_eval: "",
            starting_code: "",
            extra_instructor_files: "",
            extra_starting_files: "",
            forked_id: 0,
            forked_version: 0,
            owner_id: 0,
            course_id: 0,
            version: 0
        });
    }

    getLocalStorageKey(): string {
        return `COURSE_${this.courseId}_ASSIGNMENTS`;
    }

    getByUrl(url: string): Promise<Assignment> {
        return new Promise((resolve, reject) => {
            ajax_get("assignments/by_url", {url, course_id: this.courseId}).then((data) => {
                if (data.success) {
                    let rawAssignment: AssignmentJson = data.assignment;
                    let created: Assignment = this.newInstance(rawAssignment);
                    resolve(created);
                } else {
                    reject(data);
                }
            });
        });
    }

    /** Preload the full course listing (with each assignment's group, aligned by
     * index like assignments/get_ids) so selectors don't need to fetch it. */
    preloadWithGroups(assignments: AssignmentJson[], groups: (AssignmentGroupJson | null)[]): Assignment[] {
        const created = assignments.map((assignmentJson: AssignmentJson, index: number) => {
            const assignment = this.newInstance(assignmentJson);
            if (groups[index] != null) {
                assignment.group(this.server.assignmentGroupStore.newInstance(groups[index]));
            }
            return assignment;
        });
        this.allAvailable = created.sort(compareAssignmentsByGroup);
        return this.allAvailable;
    }

    getAllAvailable(payload?: any) {
        if (this.allAvailable !== null) {
            return Promise.resolve(this.allAvailable);
        }
        payload = payload || this.getPayload();
        let url = this.getUrl();
        return new Promise((resolve, reject) => {
            ajax_get(url, payload).then((data) => {
                if (data.success) {
                    let assignments: AssignmentJson[] = data.assignments;
                    let groups: AssignmentGroupJson[] = data.groups;
                    let created: Assignment[] = [];
                    for (let i=0; i<assignments.length; i+= 1) {
                        let assignment = this.newInstance(assignments[i]);
                        if (groups[i] !== null) {
                            let group = this.server.assignmentGroupStore.newInstance(groups[i]);
                            assignment.group(group);
                        }
                        created.push(assignment);
                    }
                    resolve(created.sort(compareAssignmentsByGroup));
                } else {
                    reject(data);
                }
            });
        });
    }
}

export const AssignmentTemplate = `
    <div>Assignment: <span data-bind="text: name"></span></div>
`;

export const AssignmentShortTemplate = `
    <div>Assignment: <span data-bind="text: name, attr: {title: url}"></span></div>
`;

ko.components.register("assignment", {
    viewModel: Assignment,
    template: AssignmentTemplate
});

ko.components.register("assignment-short", {
    template: AssignmentShortTemplate
})