// Obtain a Pool of DB connections.
import { Pool, PoolConfig } from 'pg';
import fs from 'node:fs'
import { ISchemaVersion } from '../models/dbSchema';

const pgConfig: PoolConfig =
    process.env.PGHOST !== undefined
        ? {
            host: process.env.PGHOST,
            port: parseInt(process.env.PGPORT),
            user: process.env.PGUSER,
            database: process.env.PGDATABASE,
            password: process.env.PGPASSWORD,
        }
        : {
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false,
            },
        };

const pool = new Pool(pgConfig);

/**
 * Runs database up migrations from current detected version.
 */
function migrate() {
    let version: number;
    pool.query('SELECT * FROM schema_version')
        .then((res) => {
            version = (<ISchemaVersion><unknown>res)?.version;
            if (!version) {
                upgrade1();
            } else if (version == 1) {
                console.log("Database schema up to date")
                return;
            } else {
                throw new Error(`Invalid database schema version: ${version}`);
            }
        })
        .catch((err) => {
            //Err 42P01 = failed to find table
            if (err.code == "42P01") {
                upgrade1();
            }
        })
}

function upgrade1() {
    try {
        const query = fs.readFileSync("migrations/up1.sql");
        console.log("Retrieved migration script, running upgrade 1")
        console.log(query.toString());
        pool.query(query.toString())
            .then(() => console.log("Upgraded to DB Schema v1"))
    } catch (error) {
        console.error(`Failed to upgrade DB Schema due to ${error}`)
        throw error;
    }
}

export { pool, migrate };
