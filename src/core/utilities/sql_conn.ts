// Obtain a Pool of DB connections.
import { Pool, PoolConfig } from 'pg';
import fs from 'node:fs';
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
            version = res.rows[0]?.version;
            switch (version) {
                case 1 :
                    upgrade2();
                    break;
                case 2 :
                    console.log('DB Schema v2 up to date!');
                    break;
                default :
                    throw new Error(`Unrecognized database schema version ${version}, panicking!`);
            }
        })
        .catch((err) => {
            //Err 42P01 = failed to find table
            if (err.code == '42P01') {
                upgrade1();
            } else {
                console.error(`Unable to upgrade database due to ${err}`)
            }
        });
}

function upgrade1() {
    try {
        const query = fs.readFileSync('migrations/up1.sql');
        console.log('Retrieved migration script, running upgrade 1');
        pool.query(query.toString())
            .then(() => console.log('Upgraded to DB Schema v1'));
    } catch (error) {
        console.error(`Failed to upgrade DB Schema due to ${error}`);
        throw error;
    }
}

function upgrade2() {
    try {
        const query = fs.readFileSync('migrations/up2.sql');
        console.log('Retrieved migration script, running upgrade 2');
        pool.query(query.toString())
            .then(() => console.log('Upgraded to DB Schema v2'));
    } catch (err) {
        console.error(`Failed to upgrade DB schema to v2 due to ${err}`);
        throw err;
    }
}

export { pool, migrate };
