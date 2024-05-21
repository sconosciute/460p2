// Obtain a Pool of DB connections.
import { Pool, PoolConfig } from 'pg';
import fs from 'node:fs';
import { ISchemaVersion } from '../models/dbSchema';

const up1Path = 'migrations/up1.sql';
const up2Path = 'migrations/up2.sql';
const up3Path = 'migrations/up3.sql';
const up4Path = 'migrations/up4.sql';

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
async function migrate() {
    try {
        const res = await pool.query('SELECT * FROM schema_version');
        await migrateFromVersion(res.rows[0].version)
    } catch (err) {
        //Err 42P01 = failed to find table
        if (err.code == '42P01') {
            await migrateFromVersion(0);
        } else {
            console.error(`Unable to upgrade database due to ${err}`);
        }
    }
}

async function migrateFromVersion(version: number) {
    switch (version) {
        case 0 :
            console.log('Upgrading DB Schema to V1');
            await upgrade(up1Path);
        case 1 :
            console.log('Upgrading DB Schema to V2');
            await upgrade(up2Path);
        case 2 :
            console.log('Upgrading DB Schema to V3');
            await upgrade(up3Path);
        case 3 :
            console.log('Upgrading to DB Schema V4');
            await upgrade(up4Path);
        case 4 :
            console.log('DB Schema V4 up to date');
            break;
        default :
            throw new Error(`Unrecognized database schema version ${version}, panicking!`);
    }
}

async function upgrade(path: string) {
    try {
        const query = fs.readFileSync(path);
        console.log('Retrieved migration script, running upgrade');
        await pool.query(query.toString());
        console.log('Upgraded DB Schema Successfully')
    } catch (err) {
        console.error(`Failed to upgrade DB schema due to ${err}`);
        throw err;
    }
}

export { pool, migrate };
