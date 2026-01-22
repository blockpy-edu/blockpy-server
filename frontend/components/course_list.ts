import {Server} from "../services/server";
import {Course} from "../models/course";
import {User} from "../models/user";
import * as ko from 'knockout';
import {Watcher, WatcherTemplate} from "./watcher/watcher";
import {prettyPrintDateTime} from "../utilities/dates";
import {STORAGE_SERVICE} from "../utilities/safe_local_storage";
import {ajax_post, hideOverlay, showOverlay} from "../services/ajax";

export interface CourseListInterfaceJson {
    server: Server;
    courses: Course[];
    user: User;
    label: string;
}

export class CourseListInterface {
    server: Server;
    courses: KnockoutObservableArray<Course>;
    user: User;
    label: string;
    private sortMethod: ko.Observable<string>;
    sorter: (left: Course, right: Course) => number;
    private pins: ko.Observable<Record<string, boolean>>;

    constructor(params: CourseListInterfaceJson) {
        this.server = params.server;
        this.courses = ko.observableArray<Course>(params.courses);
        this.user = params.user;
        this.label = params.label;
        this.sortMethod = ko.observable(STORAGE_SERVICE.get("COURSE_SORT_METHOD_"+this.label,
            "date_created_desc"));
        this.sorter = this._sorter.bind(this);
        this.sortMethod.subscribe(() => {
            STORAGE_SERVICE.set("COURSE_SORT_METHOD_"+this.label, this.sortMethod());
        });
        this.pins = this.loadPins();
    }

    loadPins() {
        const rawPins = STORAGE_SERVICE.get("COURSE_PINS_"+this.label, "{}");
        const pins = JSON.parse(rawPins);
        return ko.observable<Record<string, boolean>>(pins);
    }

    updatePin(courseId: number, isPinned: boolean) {
        let pins = this.pins();
        pins[courseId.toString()] = isPinned;
        this.pins(pins);
        STORAGE_SERVICE.set("COURSE_PINS_"+this.label, JSON.stringify(pins));
    }

    getPin(courseId: number): boolean {
        let pins = this.pins();
        return pins[courseId.toString()] || false;
    }

    _sorter(left: Course, right: Course): number {
        let sortMethod = this.sortMethod();
        if (this.getPin(left.id) || this.getPin(right.id)) {
            return (+this.getPin(right.id)||0) - (+this.getPin(left.id)||0);
        }
        if (sortMethod === "date_created_desc") {
            return left.dateCreated() === right.dateCreated() ? 0
                 : left.dateCreated() < right.dateCreated() ? 1 : -1;
        } else if (sortMethod === "date_created_asc") {
            return left.dateCreated() === right.dateCreated() ? 0
                 : left.dateCreated() < right.dateCreated() ? -1 : 1;
        } else if (sortMethod === "name_asc") {
            return left.name() === right.name() ? 0
                 : left.name() < right.name() ? -1 : 1;
        } else if (sortMethod === "name_desc") {
            return left.name() === right.name() ? 0
                 : left.name() < right.name() ? 1 : -1;
        } else {
            return 0;
        }
    }

    getRole(id: number): string {
        let roles = this.user.roles();
        for (let i=0; i<roles.length; i+=1) {
            let role = roles[i];
            if (role.courseId() === id) {
                return role.name();
            }
        }
        return "No Role";
    }

    changePinStatus(course: Course) {
        this.updatePin(course.id, !this.getPin(course.id));
    }
}

export const COURSE_LIST_HTML = `
<span class="float-right">
<label data-bind="attr: {'for': 'sort-select-'+label}">Sort by:</label>
<select data-bind="attr: {'name': 'sort-select-'+label, 'id': 'sort-select-'+label},
    value: sortMethod">
    <option value="date_created_desc" selected>Most Recently Created</option>
    <option value="date_created_asc">Oldest Created</option>
    <option value="name_asc">Name Ascending</option>
    <option value="name_desc">Name Descending</option>
</select>
</span>
<ul>
<!-- ko foreach: courses.sort(sorter) -->
    <li class="media mt-2 border-bottom" style="width: 100%">
        <a data-bind="attr: {href: id}" class="btn btn-primary mr-3">
            <span class="fas fa-eye"></span> Open
        </a>
        <div class="media-body">
            <div class="d-flex w-100 justify-content-between">
                <h5 class="mb-1" data-bind="text: name"></h5>
                <span class="fa-star align-right clickable" 
                    data-bind="click: $parent.changePinStatus.bind($parent, $data),
                    css: {'far': !$parent.getPin(id), 'fas': $parent.getPin(id)}
                    "></span>
            </div>
            <p class="mb-1">
                <small class="text-muted" data-bind="text: prettyDateCreated"></small><br>
                Role: <span data-bind="text: $parent.getRole(id)" class="text-capitalize"></span>
            </p>
            <small class="text-muted" data-bind="if: url">
                Course URL: <code data-bind="text: url"></code>,
            </small>
            <small class="text-muted" data-bind="if: service()!=='native'">
                LMS: <span data-bind="text: service"></span>,
            </small>
            <small class="text-muted">
                Course ID: <span data-bind="text: id"></span>
            </small>
        </div>
    </li>
<!-- /ko -->
</ul>
`;

ko.components.register("course-list", {
    viewModel: CourseListInterface,
    template: COURSE_LIST_HTML
});

