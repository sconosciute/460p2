CREATE TABLE IF NOT EXISTS schema_version
(
    version      SMALLINT  NOT NULL DEFAULT 0,
    upgrade_date TIMESTAMP NOT NULL
);

TRUNCATE schema_version;
INSERT INTO schema_version
VALUES (1, CURRENT_TIMESTAMP);


CREATE TABLE IF NOT EXISTS roles
(
    id           SERIAL PRIMARY KEY,
    role_name    TEXT    NOT NULL,
    admin        BOOLEAN NOT NULL,
    update_add   BOOLEAN NOT NULL,
    delete       BOOLEAN NOT NULL,
    manage_users BOOLEAN NOT NULL
);

TRUNCATE account CASCADE;
ALTER TABLE account
    DROP COLUMN IF EXISTS account_role;
ALTER TABLE account
    ADD COLUMN IF NOT EXISTS role_id INTEGER NOT NULL REFERENCES roles (id);

CREATE TABLE IF NOT EXISTS authors
(
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS book_author
(
    id     SERIAL PRIMARY KEY,
    book   INTEGER NOT NULL REFERENCES books (id),
    author INTEGER NOT NULL REFERENCES authors (id)
);

ALTER TABLE book_author
    DROP CONSTRAINT IF EXISTS book_author_unique;
ALTER TABLE book_author
    ADD CONSTRAINT book_author_unique UNIQUE (book, author);

do
$$
    DECLARE
        book        books%rowtype;
        author_name text;
        author_id   integer;
    BEGIN
        FOR book IN SELECT * FROM books
            LOOP
                FOREACH author_name IN ARRAY STRING_TO_ARRAY(book.authors, ',')
                    LOOP
                        author_name = TRIM(BOTH ' ' FROM author_name);
                        SELECT a.id INTO author_id FROM authors a WHERE a.name = author_name;
                        IF NOT FOUND THEN
                            INSERT INTO authors (name) VALUES (author_name) RETURNING id INTO author_id;
                        END IF;
                        INSERT INTO book_author (book, author) VALUES (book.id, author_id) ON CONFLICT DO NOTHING;
                    END LOOP;
            END LOOP;
        ALTER TABLE books
            DROP COLUMN authors;
    END;
$$