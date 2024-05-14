import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from './sql_conn';

class dbClient {
    client: PoolClient;

    constructor() {
        pool.connect()
            .then((conn) => this.client = conn);
    }

    query(text: string, values: Array<string>): Promise<QueryResult | void> {
        let ret: Promise<QueryResult>;
        this.client.query('BEGIN')
            .then(() => ret = this.runQuery(text, values));
        return this.client.query('COMMIT')
            .then(() => Promise.resolve(ret))
            .catch((err) => {
                console.error(`Failed to run query due to ${err}`);
                return this.client.query('ROLLBACK')
                    .then(() => Promise.reject(err))
            });
    }

    private runQuery(text: string, values: Array<string>) {
        return this.client.query(text, values).then((result) => result);
    }
}