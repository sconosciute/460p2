import { QueryResult } from 'pg';

export interface ISchemaVersion extends QueryResult{
    version: number,
    upgrade_date: Date
}

export interface IRole {
    id: number,
    name: string,
    admin: boolean,
    update_add: boolean,
    delete: boolean,
    manage_users: boolean
}

