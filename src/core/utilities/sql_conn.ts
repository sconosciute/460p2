// Obtain a Pool of DB connections.
import { Pool, PoolConfig } from 'pg';
import fs from 'node:fs';
import { ISchemaVersion } from '../models/dbSchema';

const up1Path = 'migrations/up1.sql';
const up2Path = 'migrations/up2.sql';
const up3Path = 'migrations/up3.sql';

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
            console.dir(res);
            switch (version) {
                case 1 :
                    console.log('Upgrading DB Schema to V2');
                    upgrade(up2Path);
                    break;
                case 2 :
                    console.log('Upgrading DB Schema to V3');
                    upgrade(up3Path)
                    break;
                case 3 :
                    console.log('DB Schema V3 up to date.');
                    break;
                default :
                    throw new Error(`Unrecognized database schema version ${version}, panicking!`);
            }
        })
        .catch((err) => {
            //Err 42P01 = failed to find table
            if (err.code == '42P01') {
                upgrade(up1Path);
            } else {
                console.error(`Unable to upgrade database due to ${err}`)
            }
        });
}

function upgrade(path: string) {
    try {
        const query = fs.readFileSync(path);
        console.log("Retrieved migration script, running upgrade");
        pool.query(query.toString())
            .then(() => console.log('Upgraded DB Schema Successfully'));
    } catch (err) {
        console.error(`Failed to upgrade DB schema due to ${err}`);
        throw err;
    }
}

export { pool, migrate };
