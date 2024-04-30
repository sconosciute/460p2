import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { pool } from './sql_conn'

class dbClient {
    client: PoolClient;

    constructor() {
        pool.connect()
            .then((conn) => this.client = conn)
    }

    query(text: string, values: Array<string>): Promise<QueryResult | void> {
        try {
            const ret =this.client.query(text, values).then((result) => result)
            return this.client.query("COMMIT")
                .then(() => Promise.resolve(ret))
                .catch((err) => {
                    console.error("Failed to commit transaction to database, rolling back");
                    this.client.query("ROLLBACK").then(() => Promise.reject(err))
                })
        } catch (err) {
            console.error("Failed to commit transaction to database, rolling back");
            this.client.query("ROLLBACK")
                .then(() => console.log("Successfully rolled back"));
        }
    }
    }