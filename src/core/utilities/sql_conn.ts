// Obtain a Pool of DB connections.
import { Pool, PoolConfig } from 'pg';

console.log(process.env)
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

function initDb(){
    //@formatter:off
    const query: string = `create table if not exists demo
        (
            id       serial
                constraint demo_pk
                    primary key,
            name     text    not null
                constraint unique_name
                    unique,
            message  text    not null,
            priority integer not null,
            constraint priority_check
                check (demo.priority >= 1 and demo.priority <= 3)
        );`
    //@formatter:on
    pool.query(query)
        .then(r => console.log("Database formatted successfully"))
        .catch(err => console.log("Failed to format database due to: \n" + err));
}

export { pool, initDb };
