DO
$$
    DECLARE
        min_val INTEGER;
    BEGIN
        min_val := (SELECT MAX(id) + 1 FROM books);
        CREATE SEQUENCE id_ser OWNED BY books.id;
        PERFORM setval('id_ser', min_val);

        ALTER TABLE books
            ALTER id SET DEFAULT nextval('id_ser');
        TRUNCATE TABLE schema_version;
        INSERT INTO schema_version (version, upgrade_date) VALUES (5, CURRENT_TIMESTAMP);
    END;
$$