TRUNCATE schema_version;

ALTER TABLE book_author
    DROP CONSTRAINT book_author_book_fkey;

ALTER TABLE book_author
    ADD CONSTRAINT book_author_book_fkey
        FOREIGN KEY (book)
            REFERENCES books (id)
            ON DELETE CASCADE;

INSERT INTO schema_version (version, upgrade_date) VALUES (4, CURRENT_TIMESTAMP);