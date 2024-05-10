import { QueryResult } from 'pg';

export interface ISchemaVersion extends QueryResult{
    version: number,
    upgrade_date: Date
}

