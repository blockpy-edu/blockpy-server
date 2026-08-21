import * as ko from 'knockout';
import {TwoWayReadonlyMap} from "../services/plugins";
import {ajax_get} from "../services/ajax";
import {prettyPrintDateTime} from "../utilities/dates";
import {Server} from "../services/server";

export interface ModelJson {
    id: number;
    date_modified: string;
    date_created: string;
}


export abstract class Model<T extends ModelJson> {
    id: number;
    dateCreated: ko.Observable<string>;
    dateModified: ko.Observable<string>;
    private readonly prettyDateCreated: KnockoutReadonlyComputed<string>;
    private readonly prettyDateModified: KnockoutReadonlyComputed<string>;

    FIELDS: TwoWayReadonlyMap = new TwoWayReadonlyMap({
        "date_modified": "dateModified",
        "date_created": "dateCreated"
    });

    protected constructor(data: T) {
        this.id = data.id;
        this.dateModified = ko.observable(data.date_modified);
        this.dateCreated = ko.observable(data.date_created);
        this.prettyDateCreated = ko.pureComputed(() => prettyPrintDateTime(this.dateCreated()));
        this.prettyDateModified = ko.pureComputed(() => prettyPrintDateTime(this.dateModified()));
    }

    fromJson(data: T) {
        this.FIELDS.lefts.forEach((left) => {
            // @ts-ignore
            this[this.FIELDS.get(left)](data[left]);
        });
    }

    koFromJson(data: T) {
        this.FIELDS.lefts.forEach((left) => {
            // @ts-ignore
            this[this.FIELDS.get(left)] = ko.observable(data[left]);
        });
    }

    toJson(): T {
        let data = {id: this.id};
        // @ts-ignore
        this.FIELDS.rights.forEach((right) => data[this.FIELDS.get(right)]=this[right]());
        return <T>data;
    }

}


export function dateCreatedSorter<J extends ModelJson, L extends Model<J>>(left: L, right: L): number {
    return left.dateCreated() === right.dateCreated() ? 0
         : left.dateCreated() < right.dateCreated() ? -1
         : 1;
}


export abstract class ModelStore<J extends ModelJson, T extends Model<J>> {
    protected readonly data: Record<number, T>;
    protected courseId: number|null;
    // When set, getAllAvailable() resolves immediately instead of hitting the server
    protected allAvailable: T[] = null;

    private timer: number;
    private readonly delayedData: ko.ObservableArray<T>;
    isLoading: ko.PureComputed<boolean>;

    protected readonly server: Server;

    constructor(server: Server, courseId: number|null, initialIds: number[], initialData: J[]) {
        this.data = {};
        this.server = server;
        this.courseId = courseId;
        this.delayedData = ko.observableArray([]);
        this.timer = null;
        if (initialData !== undefined) {
            initialData.map((instance: J) => this.newInstance(instance));
        }
        if (initialIds !== undefined) {
            initialIds.map((id: number) => this.getInstance(id));
        }

        this.isLoading = ko.pureComputed(() => {
            return this.delayedData().length > 0;
        }, this);
    }

    getInstance(id: number): T {
        if (this.data[id] !== undefined) {
            return this.data[id];
        } else {
            let delayedInstance = this.makeEmptyInstance(id);
            this.data[id] = delayedInstance;
            // A preloaded store already holds everything available, so an unknown
            // id is simply unknown - never re-fetch. Invalid ids (null/NaN from
            // half-initialized selections) must also never reach the server.
            if (id != null && !isNaN(id) && this.allAvailable === null) {
                this.delayLoadInstance(delayedInstance);
            }
            return delayedInstance;
        }
    }

    delayLoadInstance(instance: T) {
        clearTimeout(this.timer);
        this.delayedData.push(instance);
        this.queueFinishDelay();
    }

    queueFinishDelay() {
        if (this.delayedData().length > 25) {
            this.finishDelayedLoads();
        } else if (this.delayedData().length > 0) {
            this.timer = window.setTimeout(this.finishDelayedLoads.bind(this), 1000);
        }
    }

    getInstances(ids: number[]): T[] {
        return ids.map(this.getInstance.bind(this));
    }

    getLoaded(): T[] {
        // @ts-ignore
        return Object.keys(this.data).map((key: number) => this.data[key]);
    }

    /**
     * Seed this store with the complete list of available models (e.g., data
     * embedded in the page at render time), so getAllAvailable() resolves
     * instantly instead of making a request.
     */
    preload(initialData: J[]): T[] {
        const created = initialData.map((modelJson: J) => this.newInstance(modelJson));
        this.allAvailable = this.cleanData(created);
        return this.allAvailable;
    }

    getAllAvailable(payload?: object) {
        if (this.allAvailable !== null) {
            return Promise.resolve(this.allAvailable);
        }
        if (payload === undefined) {
            payload = this.getPayload();
        }
        let url = this.getUrl();
        return new Promise((resolve, reject) => {
            ajax_get(url, payload).then((data) => {
                if (data.success) {
                    let results = data[this.GET_FIELD];
                    let created = results.map( (modelJson: J) => {
                        return this.newInstance(modelJson);
                    });
                    resolve(this.cleanData(created));
                } else {
                    reject(data);
                }
            });
        });
    }

    cleanData(models: T[]): T[] {
        return models;
    }

    /**
     * Start keeping track of the given instance
     * @param instance
     */
    trackInstance(instance: T): T {
        this.data[instance.id] = instance;
        return instance;
    }

    /**
     * Create a new instance from the model and track it
     * @param modelJson
     */
    newInstance(modelJson: J): T {
        this.data[modelJson.id] = this.makeEmptyInstance(modelJson.id);
        this.data[modelJson.id].fromJson(modelJson);
        return this.data[modelJson.id];
    }

    abstract getUrl(): string;
    abstract getLocalStorageKey(): string;
    abstract getPayload(): any;
    abstract makeEmptyInstance(id: number): T;
    abstract GET_FIELD: string;

    sortMethod(left: T, right: T): number {
        return 0;
    }

    finishDelayedLoads() {
        let payload = this.getPayload();
        let url = this.getUrl();
        const requested = this.getDelayedIds();
        return ajax_get(url, payload).then((data) => {
           if (data.success) {
               let results = data[this.GET_FIELD];
               results.forEach((modelJson: J) => {
                   if (this.data[modelJson.id] !== undefined) {
                       this.data[modelJson.id].fromJson(modelJson);
                   }
               });
           } else {
               console.error(data);
           }
           // Clear everything that was asked about, including ids the server did
           // not recognize - otherwise they would be re-requested every second.
           this.removeDelayedInstances(requested);
        }, () => {
           this.removeDelayedInstances(requested);
        });
    }

    protected getDelayedIds(): number[] {
        return this.delayedData().map((instance: T) => instance.id);
    }

    removeDelayedInstances(ids: number[]) {
        this.delayedData(this.delayedData().filter((delayedInstance: T) => !ids.includes(delayedInstance.id)));
        this.queueFinishDelay();
    }
}