/**
 * Assignment model
 */

export interface AssignmentJson {
  id: number;
  name: string;
  body?: string;
}

export class Assignment {
  id: number;
  private _name: string;
  private _body?: string;

  constructor(data: AssignmentJson) {
    this.id = data.id;
    this._name = data.name;
    this._body = data.body;
  }

  name(): string { return this._name; }
  body(): string | undefined { return this._body; }
  
  title(): string {
    return this._name;
  }
}
