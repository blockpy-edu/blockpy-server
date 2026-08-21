import * as ko from 'knockout';
import {Model, ModelJson, ModelStore} from "../models/model";
import {User, UserJson, UserStore} from "../models/user";
import {areArraysEqualSets, naturalCompare, pushObservableArray} from "../services/plugins";
import {Assignment, AssignmentJson} from "../models/assignment";
import {STORAGE_SERVICE} from "../utilities/safe_local_storage";

// TODO: "Add all" and "Remove all" buttons for Set menu
// TODO: If only one available, then collapse everything to just the one
// TODO: Preload all groups/roles as default groups

interface ModelSetJson {
    name: string;
    ids: number[];
    default: boolean;
}

export class ModelSet {
    name: KnockoutObservable<string>;
    ids: KnockoutObservableArray<number>;
    default: KnockoutObservable<boolean>;

    constructor(params: ModelSetJson) {
        this.name = ko.observable(params.name);
        this.ids = ko.observableArray<number>(params.ids);
        this.default = ko.observable(params.default);
    }

    getIds(): string {
        return this.ids().join(",");
    }

    toJson(): ModelSetJson {
        return {
            name: this.name(),
            ids: this.ids(),
            default: this.default()
        }
    }

    getStored() {
        if (this.default()) {
            return "";
        } else {
            return this.getIds();
        }
    }
}

interface ModelSetSelectorJson<J extends ModelJson, T extends Model<J>> {
    store: ModelStore<J, T>;
    modelSet: KnockoutObservable<ModelSet>;
    default: string;
    // Optional two-way channel exposing/controlling this selector's ALL/SINGLE/SET mode,
    // so a parent can coordinate multiple selectors (e.g., "not both ALL at once").
    mode?: KnockoutObservable<SelectMode>;
    // Optional channel for a parent to re-apply a selection later (same format as
    // `default`: "", "first", a single id, or a comma-separated id list).
    applySelection?: KnockoutObservable<string>;
    // Optional flag the selector sets to true once its data has loaded and the
    // default selection has been applied - before that, mode changes are just
    // initialization noise that parents should not react to.
    ready?: KnockoutObservable<boolean>;
}

export enum SelectMode {
    ALL="ALL", SINGLE="SINGLE", SET="SET"
}


export class ModelSetSelector<J extends ModelJson, T extends Model<J>> {
    protected store: ModelStore<J, T>;
    sets: KnockoutObservableArray<ModelSet>;
    currentSet: KnockoutObservable<ModelSet>;

    private readonly editorVisible: KnockoutObservable<boolean>;
    private readonly selectMode: KnockoutObservable<SelectMode>;
    protected readonly available: KnockoutObservableArray<T>;
    private readonly selectedOptions: KnockoutObservableArray<number>;
    private readonly singleSet: KnockoutObservable<ModelSet>;
    private readonly singleOption: KnockoutObservable<number>;
    private readonly showAll: KnockoutObservable<boolean>;
    private readonly showAllThreshold: number = 7;
    private bulkEditor: KnockoutObservable<string>;
    protected prettyResult: KnockoutReadonlyComputed<T[]>;
    private readonly isLoading: KnockoutObservable<boolean>;
    protected nameAttr: string = "name";
    protected getItemGroups: KnockoutReadonlyComputed<ModelSelectorItemGroup<J, T>[]>;

    constructor(params: ModelSetSelectorJson<J, T>) {
        // Create the complete list of users
        this.store = params.store;
        this.available = ko.observableArray<T>([]);
        this.isLoading = ko.observable(true);
        this.store.getAllAvailable().then((models: T[]) => {
            pushObservableArray(this.available, models);
            // Set first set to be ALL models
            this.sets()[0].ids(models.map((u: T) => u.id));
            // Load any custom user sets
            this.loadDefault(params.default);
            // Load in any grouped sets from the DB
            this.loadGroups();
            this.isLoading(false);
            if (params.ready != null) {
                params.ready(true);
            }
        });

        // Create single person model
        this.selectMode = ko.observable<SelectMode>(SelectMode.ALL);
        this.singleSet = ko.observable<ModelSet>(new ModelSet({default: false, ids: [], name: "Just this one"}))
        this.singleOption = ko.observable<number>(null);
        // Load in existing user sets, or create default one
        let sets = this.loadFromLocalStorage().map((item:ModelSetJson)=> new ModelSet(item));
        this.sets = ko.observableArray<ModelSet>(sets);
        // Set the current user set to be the default user set
        this.currentSet = params.modelSet;
        this.currentSet(this.sets()[0]);
        // Hide the editor
        this.editorVisible = ko.observable(false);

        // MultiSelect of selectable users
        this.selectedOptions = ko.observableArray<number>([]);
        // Bulk add emails/IDs
        this.bulkEditor = ko.observable<string>("");
        // Default to not show all names
        this.showAll = ko.observable(false);

        this.currentSet.subscribe(() => {
            if (this.editorVisible()) {
                this.selectedOptions(this.currentSet().ids());
            }
        });

        this.singleOption.subscribe(() => {
            // The dropdown can transiently write null while (re)rendering; a null
            // id must never become part of the set (it would look like a real model).
            if (this.singleOption() != null) {
                this.singleSet().ids([this.singleOption()]);
                this.currentSet(this.singleSet());
            }
        });

        this.selectMode.subscribe(() => {
            switch (this.selectMode()) {
                case SelectMode.ALL: case SelectMode.SET:
                    this.currentSet(this.sets()[0]);
                    break;
                case SelectMode.SINGLE:
                    this.currentSet(this.singleSet());
            }
        }, this);

        this.selectedOptions.subscribe((changes) => {
            if (this.currentSet().default()) {
                let anyDeletions = changes.some((change) => change.status === "deleted");
                if (anyDeletions) {
                    let newOptions = this.selectedOptions();
                    this.startAdding(newOptions);
                }
            }
        }, this, "arrayChange");

        this.prettyResult = ko.pureComputed<T[]>( () => {
            let ids = this.currentSet().ids();
            if (!this.showAll()) {
                ids = ids.slice(0, this.showAllThreshold);
            }
            return ids.map((id: number) => this.store.getInstance(id));
        }, this);

        if (params.mode != null) {
            const externalMode = params.mode;
            externalMode(this.selectMode());
            this.selectMode.subscribe((mode: SelectMode) => {
                if (externalMode() !== mode) {
                    externalMode(mode);
                }
            });
            externalMode.subscribe((mode: SelectMode) => {
                if (mode != null && mode !== this.selectMode()) {
                    this.selectMode(mode);
                }
            });
        }
        if (params.applySelection != null) {
            params.applySelection.subscribe((value: string) => {
                if (value != null) {
                    this.loadDefault(value);
                    params.applySelection(null);
                }
            });
        }
    }

    getDefaultGroupSetName(): string {
        return "Everything";
    }

    getNewGroupSetName(): string {
        return "New set";
    }

    loadFromLocalStorage(): ModelSetJson[] {
        // Need CourseID for this too
        let sets = STORAGE_SERVICE.get(this.store.getLocalStorageKey());
        if (sets === null) {
            return [{name: this.getDefaultGroupSetName(), default: true, ids: []}];
        } else {
            return JSON.parse(sets);
        }
    }

    startEditing() {
        this.editorVisible(true);
        this.selectedOptions(this.currentSet().ids());
    }

    /** Remove one model from the current set (the chips' X buttons). Default sets
     * must stay intact, so removing from one forks the remainder into a new custom
     * set - the same rule the editor's multiselect applies on deselection. */
    removeFromSet(model: T) {
        const remaining = this.currentSet().ids().filter((id: number) => id !== model.id);
        if (this.currentSet().default()) {
            this.startAdding(remaining);
        } else {
            this.currentSet().ids(remaining);
            this.saveToLocalStorage();
        }
    }

    startAdding(ids?: number[]): ModelSet {
        let newSet = new ModelSet({name: this.getNewGroupSetName(), default: false, ids: ids || []});
        this.sets.push(newSet);
        this.currentSet(newSet);
        this.editorVisible(true);
        return newSet;
    }

    addAsEmails() {
        // Parse the bulkEditor for emails
        // Add them to the currently selectedOptions
        // Clear the bulkEditor for any identified people
    }

    loadDefault(value: string) {
        if (value === "first") {
            this.selectMode(SelectMode.SINGLE);
            if (this.available().length) {
                this.singleOption(this.available()[0].id);
            }
        } else if (value === "all" || value.trim() === "") {
            this.selectMode(SelectMode.ALL);
            this.currentSet(this.sets()[0]);
        } else {
            let ids = value.split(",").map((id: string) => parseInt(id, 10));
            switch (ids.length) {
                case 0: case this.available().length:
                    this.selectMode(SelectMode.ALL);
                    this.currentSet(this.sets()[0]);
                    break;
                case 1:
                    if (this.available().some((model: T) => model.id === ids[0])) {
                        this.selectMode(SelectMode.SINGLE);
                        this.singleOption(ids[0]);
                    }
                    break;
                default:
                    this.sets().forEach((modelSet: ModelSet) => {
                        if (areArraysEqualSets(modelSet.ids(), ids)) {
                            this.selectMode(SelectMode.SET);
                            this.currentSet(modelSet);
                        }
                    });
                    break;
            }
        }
    }

    loadGroups() {
        this.getItemGroups().forEach((group: ModelSelectorItemGroup<J, T>) => {
            this.sets().push(new ModelSet({
                name: group.name,
                default: true,
                ids: group.children.map((model: T) => model.id)
            }));
        });
    }

    deleteSet(): boolean {
        if (this.currentSet().default()) {
            this.editorVisible(false);
            return false;
        }
        if (confirm("Are you sure you want to delete this set?")) {
            let deleted = this.currentSet();
            this.currentSet(this.sets()[0]);
            this.sets.remove(deleted);
            this.saveToLocalStorage();
            this.editorVisible(false);
            return true;
        }
        return false;
    }

    saveSet() {
        this.currentSet().ids(this.selectedOptions());
        this.saveToLocalStorage();
        this.editorVisible(false);
    }

    cancelEdit() {
        this.editorVisible(false);
    }

    private saveToLocalStorage() {
        let modelSetJson = JSON.stringify(this.sets().map((m: ModelSet) => m.toJson()));
        STORAGE_SERVICE.set(this.store.getLocalStorageKey(), modelSetJson);
    }
}

export interface ModelSelectorLabels {
    // Unique key used for the radio group's name/ids ("User", "Assignment")
    setName: string;
    // The three selection modes, phrased as answers to "whose/which?"
    allLabel: string;
    singleLabel: string;
    setLabel: string;
    // Nouns for counts ("2 students selected") and the select2 placeholder
    itemSingular: string;
    itemPlural: string;
    // The quiet link that opens the set editor
    manageLabel: string;
}

export const MODEL_SET_SELECTOR_HTML = (labels: ModelSelectorLabels) => `
    <div>
        <!-- Mode Select: which kind of selection is being made -->
        <div class="form-check">
            <input class="form-check-input"
                   data-bind="checked: selectMode, disable: isLoading"
                   type="radio" name="${labels.setName}" id="${labels.setName}1" value="ALL">
            <label class="form-check-label" for="${labels.setName}1">
                ${labels.allLabel}
            </label>
        </div>
        <div class="form-check">
            <input class="form-check-input"
                   data-bind="checked: selectMode, disable: isLoading"
                   type="radio" name="${labels.setName}" id="${labels.setName}2" value="SINGLE">
            <label class="form-check-label" for="${labels.setName}2">
                ${labels.singleLabel}
            </label>
        </div>
        <div class="form-check">
            <input class="form-check-input"
                   data-bind="checked: selectMode, disable: isLoading"
                   type="radio" name="${labels.setName}" id="${labels.setName}3" value="SET">
            <label class="form-check-label" for="${labels.setName}3">
                ${labels.setLabel}
            </label>
        </div>

        <div data-bind="if: isLoading">
            <div class="spinner-loader" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        </div>

        <!-- All: nothing to configure, just confirm the scope -->
        <!-- ko if: selectMode() === 'ALL' && !isLoading() -->
        <div class="text-muted small mt-2">
            Including all <span data-bind="text: available().length"></span> ${labels.itemPlural}.
        </div>
        <!-- /ko -->

        <!-- Single: just the one dropdown -->
        <!-- ko if: selectMode()==='SINGLE' -->
        <div class="mt-2">
        <form class="form-inline">
        <select aria-label="${labels.singleLabel}"
                data-bind="foreach: getItemGroups(), value: singleOption, optionsText: 'title', optionsValue: 'id'"
                class="form-control custom-select custom-select-sm">
            <optgroup data-bind="attr: {label: name}, foreach: children">
                <option data-bind="text: $data.title(), option: $data.id"></option>
            </optgroup>
        </select>
        </form>
        </div>
        <!-- /ko -->

        <!-- Saved set: the set dropdown, then a count + chips as confirmation -->
        <!-- ko if: selectMode()==='SET' -->
        <div class="mt-2">
        <form class="form-inline">
            <select aria-label="${labels.setLabel}"
                    data-bind="options: sets,
                               optionsText: 'name',
                               valueAllowUnset: true,
                               value: currentSet"
                    class="form-control custom-select custom-select-sm">
            </select>
        </form>
        <div data-bind="ifnot: editorVisible">
            <div class="text-muted small mt-2"
                 data-bind="text: currentSet().ids().length === 1
                                ? '1 ${labels.itemSingular} selected'
                                : currentSet().ids().length + ' ${labels.itemPlural} selected'"></div>
            <div class="mt-1">
                <!-- ko foreach: prettyResult -->
                <span class="badge badge-light border mr-1 mb-1" style="font-weight: normal">
                    <span data-bind="text: title"></span>
                    <button type="button" class="border-0 bg-transparent p-0 ml-1"
                            style="line-height: 1; cursor: pointer"
                            data-bind="click: (model) => $parent.removeFromSet(model),
                                       attr: {'aria-label': 'Remove ' + title(), title: 'Remove ' + title()}">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </span>
                <!-- /ko -->
                <!-- ko if: currentSet().ids().length > showAllThreshold -->
                <button type="button" class="btn btn-outline-secondary btn-sm mb-1"
                        data-bind="click: () => showAll(!showAll())">
                    <span data-bind="if: showAll">
                        Show fewer
                    </span>
                    <span data-bind="ifnot: showAll">
                        Show all <span class="badge badge-light" data-bind="text: currentSet().ids().length - showAllThreshold"></span> more
                    </span>
                </button>
                <!-- /ko -->
            </div>
            <button type="button" class="btn btn-link btn-sm px-0"
                    data-bind="click: startEditing">${labels.manageLabel}</button>
        </div>
        <!-- ko if: editorVisible -->
        <div class="card card-body mt-2 p-3">
            <div class="form-group mb-2">
                <label class="mb-0">Set name:
                    <input type="text" class="form-control form-control-sm d-inline-block w-auto ml-1"
                           data-bind="value: currentSet().name, disable: currentSet().default">
                </label>
            </div>
           <select multiple=multiple style="width: 100%"
                 data-bind="selectedOptions: selectedOptions, valueAllowUnset: true,
                              options: available, optionsText: 'title', optionsValue: 'id',
                              select2: { placeholder: '${labels.itemPlural}', allowClear: true }"></select>

            <!-- Incomplete
            <label style="min-width: 100%">Bulk Editor (separated by commas):
                <button type="button" class="btn btn-outline-secondary btn-sm"
                    data-bind="click: addAsEmails">Add as Emails</button>
                <br>
                <textarea data-bind="value: currentSet().emails,
                                     disable: currentSet().default"
                 style="min-width: 100%"></textarea></label><br>
             -->
            <div class="mt-2">
                <button type="button" class="btn btn-success btn-sm"
                        data-bind="click: saveSet">Save set</button>
                <button type="button" class="btn btn-outline-secondary btn-sm ml-2"
                        data-bind="click: () => startAdding()">
                        <span class="fas fa-plus"></span> New set</button>
                <button type="button" class="btn btn-outline-secondary btn-sm ml-2"
                        data-bind="click: cancelEdit">Cancel</button>
                <button type="button" class="btn btn-danger btn-sm float-right"
                        data-bind="click: deleteSet">Delete set</button>
            </div>
        </div>
        <!-- /ko -->
        </div>
        <!-- /ko -->
    </div>`

export class UserSetSelector extends ModelSetSelector<UserJson, User> {

    constructor(params: ModelSetSelectorJson<UserJson, User>) {
        super(params);

        this.getItemGroups = ko.pureComputed(()=> {
            let groups: Record<string, ModelSelectorItemGroup<UserJson, User>> = {};
            this.available().forEach((u: User) => {
                if (!(u.primaryRole() in groups)) {
                    groups[u.primaryRole()] = new ModelSelectorItemGroup<UserJson, User>(u.primaryRole(), u.roles);
                }
                groups[u.primaryRole()].children.push(u);
            });
            return Object.values(groups);
        }, this);

        (<UserStore>this.store).sortMode.subscribe(() => {
            this.available.sort(this.store.sortMethod.bind(this.store));
        });
    }

    getDefaultGroupSetName(): string {
        return "All students";
    }

    getNewGroupSetName(): string {
        return "New user set";
    }
}

export class ModelSelectorItemGroup<J extends ModelJson, T extends Model<J>> {
    name: string;
    model: any;
    children: T[];

    constructor(name: string, model: any) {
        this.name = name;
        this.model = model;
        this.children = [];
    }
}

export class AssignmentSetSelector extends ModelSetSelector<AssignmentJson, Assignment> {
    constructor(params: ModelSetSelectorJson<AssignmentJson, Assignment>) {
        super(params);

        this.getItemGroups = ko.pureComputed(()=> {
            let groups: Record<number, ModelSelectorItemGroup<AssignmentJson, Assignment>> = {};
            this.available().forEach((a: Assignment) => {
                let id, name;
                if (a.group() === null) {
                    id = -2;
                    name = "Ungrouped Assignments";
                } else {
                    id = a.group().id;
                    name = a.group().name();
                }
                if (!(id in groups)) {
                    groups[id] = new ModelSelectorItemGroup<AssignmentJson, Assignment>(name, a.group());
                }
                groups[id].children.push(a);
            });
            // Object.values iterates integer keys (the group ids) in numeric order,
            // scrambling the natural ordering - sort by name, ungrouped last.
            return Object.values(groups).sort((left, right) => {
                if ((left.model == null) !== (right.model == null)) {
                    return left.model == null ? 1 : -1;
                }
                return naturalCompare(left.name, right.name);
            });
        }, this);
    }

    protected nameAttr: string = "title";

    getDefaultGroupSetName(): string {
        return "All assignments";
    }

    getNewGroupSetName(): string {
        return "New assignment set";
    }
}

ko.components.register("user-set-selector", {
    viewModel: UserSetSelector,
    template: MODEL_SET_SELECTOR_HTML({
        setName: "User",
        allLabel: "All students",
        singleLabel: "A specific student",
        setLabel: "Saved student set",
        itemSingular: "student",
        itemPlural: "students",
        manageLabel: "Manage student sets"
    })
});
ko.components.register("assignment-set-selector", {
    viewModel: AssignmentSetSelector,
    template: MODEL_SET_SELECTOR_HTML({
        setName: "Assignment",
        allLabel: "All assignments",
        singleLabel: "A specific assignment",
        setLabel: "Saved assignment set",
        itemSingular: "assignment",
        itemPlural: "assignments",
        manageLabel: "Manage assignment sets"
    })
});