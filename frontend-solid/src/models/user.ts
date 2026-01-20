/**
 * User model
 */

export interface UserJson {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export class User {
  id: number;
  private _firstName: string;
  private _lastName: string;
  private _email: string;

  constructor(data: UserJson) {
    this.id = data.id;
    this._firstName = data.first_name;
    this._lastName = data.last_name;
    this._email = data.email;
  }

  firstName(): string { return this._firstName; }
  lastName(): string { return this._lastName; }
  email(): string { return this._email; }
  
  title(): string {
    return `${this._firstName} ${this._lastName}`;
  }
}
