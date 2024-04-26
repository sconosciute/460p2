import { PoolClient } from 'pg';
import { pool } from './sql_conn'

class dbClient {
    client: PoolClient;
    active: boolean;

    constructor() {
        pool.connect()
            .then((conn) => this.client = conn)
        this.client.query('BEGIN')
            .then(() => console.log("Client transaction begun."))
    }

    query(text: string, values: Array<string>) {
        if (!this.active) {
            this.client.query('BEGIN')
                .then(() => console.log("Client transaction begun."))
        }
        this.client.query(text, values)
            .then((res) => res)
    }

    finalize() {
        if (!this.active) {
            console.log("Transaction already committed")
        }
        this.active = false;
        this.client.query('COMMIT').then((res) => console.log("Transaction committed"));
    }
}