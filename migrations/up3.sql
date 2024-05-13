


CREATE OR REPLACE FUNCTION get_authors(book_id int)
    RETURNS text
    LANGUAGE plpgsql
AS
$$
DECLARE
    list text;
BEGIN
    SELECT string_agg(name, ', ')
    INTO list
    FROM authors a
             INNER JOIN book_author ba ON a.id = ba.author
    WHERE ba.book = book_id;

    RETURN list;
END
$$;

ALTER TABLE books
    ADD COLUMN kw_vec tsvector;

UPDATE books b
SET kw_vec = to_tsvector('english', b.title || ' ' || get_authors(b.id));

-- Update index when a book is created or re-titled

CREATE OR REPLACE FUNCTION book_updated()
    RETURNS TRIGGER
    LANGUAGE plpgsql AS
$$
BEGIN
    UPDATE books b
    SET kw_vec = to_tsvector('english', b.title || ' ' || get_authors(b.id))
    WHERE b.id = NEW.id;
    RETURN NULL;
END
$$;

CREATE OR REPLACE TRIGGER book_insert_kw
    AFTER INSERT
    ON books
    FOR EACH ROW
EXECUTE FUNCTION book_updated();

CREATE OR REPLACE TRIGGER book_update_kw
    AFTER UPDATE
    ON books
    FOR EACH ROW
    WHEN (OLD.title != NEW.title)
EXECUTE FUNCTION book_updated();

-- Update index when an author is added to or removed from a book

CREATE OR REPLACE FUNCTION book_author_updated()
    RETURNS TRIGGER
    LANGUAGE plpgsql AS
$$
BEGIN
    UPDATE books b
    SET kw_vec = to_tsvector('english', b.title || ' ' || get_authors(b.id))
    WHERE b.id = CASE
                     WHEN NEW IS NOT NULL THEN NEW.book
                     ELSE OLD.book
        END;
    RETURN NULL;
END
$$;

CREATE OR REPLACE TRIGGER author_update_book_kw
    AFTER INSERT OR UPDATE OR DELETE
    ON book_author
    FOR EACH ROW
EXECUTE FUNCTION book_author_updated();

-- Update index when author is renamed

CREATE OR REPLACE FUNCTION author_updated()
    RETURNS TRIGGER
    LANGUAGE plpgsql AS
$$
DECLARE
    book_id int;
BEGIN
    FOR book_id IN (SELECT book from book_author WHERE author = NEW.id)
        LOOP
            UPDATE books b
            SET kw_vec = to_tsvector('english', b.title || ' ' || get_authors(b.id))
            WHERE b.id = book_id;
        END LOOP;
    RETURN NULL;
END
$$;

CREATE OR REPLACE TRIGGER book_update_kw
    AFTER UPDATE
    ON authors
    FOR EACH ROW
    WHEN (NEW.name != OLD.name)
EXECUTE FUNCTION author_updated();

TRUNCATE schema_version;
INSERT INTO schema_version VALUES (3, CURRENT_TIMESTAMP);

