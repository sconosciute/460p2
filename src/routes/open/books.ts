//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
import { parameterChecks } from '../../core/middleware';
import { IBook, IRatings, IUrlIcon } from '../../core/models';
import { QueryResult } from 'pg';

const bookRouter: Router = express.Router();

const validOrderby = parameterChecks.validOrderby;
const validSort = parameterChecks.validSort;
const validOffset = parameterChecks.validOffset;
const validPage = parameterChecks.validPage;
const validISBN = parameterChecks.validISBN;
const validTitle = parameterChecks.validTitle;
const validAuthor = parameterChecks.validAuthor;
const validMinMax = parameterChecks.validMinMax;

const getBooksAndAuthorsQuery = `
    SELECT * FROM books INNER JOIN 
    (SELECT book, STRING_AGG(authors.name, ', ') AS authors FROM book_author INNER JOIN 
        authors ON (authors.id = book_author.author)GROUP BY book) AS author_table
    ON (books.id = author_table.book)`;

//region helpers

/**
 * Get the result by executing the given query and send a list of IBook as response.
 *
 * @param theQuery The query to execute.
 * @param res The HTTP response.
 * @param allBooks Whether the query is retrieving all books.
 */
const queryAndResponse = (
    theQuery: string,
    values: string[],
    res: Response,
    allBooks: boolean
) => {
    pool.query(theQuery, values)
        .then((result) => {
            if (allBooks && result.rowCount == 0) {
                // Try to get all books but no book found.
                res.status(500).send({
                    message: 'Server error - Contact Support.',
                });
            } else {
                // Send the result
                res.status(200).send({
                    books: resultToIBook(result),
                });
            }
        })
        .catch((error) => {
            console.error('DB server error: ' + error);
            res.status(500).send({
                message: 'Server error.',
            });
        });
};

/**
 * Takes in a QueryResult containing complete book records and formats as IBook array.
 * @param toFormat
 */
function resultToIBook(toFormat: QueryResult) {
    return toFormat.rows.map((row) => {
        return <IBook>{
            isbn13: Number(row.isbn13),
            authors: row.authors,
            publication: Number(row.publication_year),
            original_title: row.original_title,
            title: row.title,
            ratings: <IRatings>{
                average: Number(row.rating_avg),
                count: Number(row.rating_count),
                rating_1: Number(row.rating_1_star),
                rating_2: Number(row.rating_2_star),
                rating_3: Number(row.rating_3_star),
                rating_4: Number(row.rating_4_star),
                rating_5: Number(row.rating_5_star),
            },
            icons: <IUrlIcon>{
                large: row.image_url,
                small: row.image_small_url,
            },
        };
    });
}

//endregion helpers

//region middleware

/**
 * Confirms a query parameter contains a string, a whole string, and nothing but the string
 * @param req HTTP Request
 * @param res HTTP Response
 * @param next Next Middleware Function
 */
const checkQueryHasString = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (validationFunctions.isStringProvided(req.query.q)) {
        next();
    } else {
        res.status(400).send('No query provided to search for');
    }
};

/**
 * Confirms a query is formatted correctly to perform a keyword search and does not contain additional symbols.
 * @param req HTTP Request
 * @param res HTTP Response
 * @param next Next Middleware Function
 */
const checkQueryFormat = (req: Request, res: Response, next: NextFunction) => {
    const queryPattern = /^[a-zA-Z0-9\s"-]+$/gm;
    console.log(`query: ${req.query.q}`);
    const check = (<string>req.query.q).match(queryPattern);
    console.dir(check);
    if (check?.length != 1) {
        res.status(400).send(
            'Malformed query\nQuery must be a single + separated list of keywords'
        );
    } else {
        next();
    }
};

//endregion middleware

//region getAll

/**
 * @api {get} /books/all
 *
 * @apiDescription Request to retrieve all information about all books in a certain page sorted by specified
 * attribute. The number of books display per page is specified by offset. The offset and page must be numeric.
 * If a negative or zero offset is entered, it will be converted to positive. If the page is less than 1 or
 * greater than the maximum number of page, it will redirect to the first or last page.
 * Available options for attributes:
 * - title: title of the book
 * - author: author name, if there're multiple authors, use the one the comes first in alphabet.
 * - year: publication year, if same year, order by title.
 *
 * @apiName GetAllBooks
 * @apiGroup Books
 *
 * @apiQuery {String="title","author","year"} orderby="title" The specified attribute of the book that it use
 * sort books.
 * @apiQuery {String="asc","desc"} sort="asc" The order of the book. It can be "asc" for ascending or "desc"
 * for descending.
 * @apiQuery {Number} offset=15 The number of books display per page.
 * @apiQuery {Number} page=1 The page number that starts from one.
 *
 * @apiSuccess (200 Success) {Array<IBook>} books A list of books in the given page.
 *
 * @apiError (400 Invalid page) {String} message "The page number in the request is not numeric."
 * @apiError (400 Invalid offset) {String} message "The offset in the request is not numeric."
 * @apiError (400 No book found) {String} message "Unexpected error - cannot retrieve books."
 * @apiError (500 Internal server error) {String} message "Server error - Contact Support."
 */
bookRouter.get(
    '/all',
    validOrderby,
    validSort,
    validOffset,
    validPage,
    (req: Request, res: Response) => {
        const orderQuery = {
            title: `title ${req.query.sort}`,
            author: `author_table.authors ${req.query.sort}`,
            year: `publication_year ${req.query.sort}, title ${req.query.sort}`,
        };
        const offset = Number(req.query.offset);
        const page = Number(req.query.page);
        const getBooks = `${getBooksAndAuthorsQuery} ORDER BY ${orderQuery[String(req.query.orderby)]} OFFSET $1 LIMIT $2`;
        const values = [String(offset * (page - 1)), String(req.query.offset)];
        queryAndResponse(getBooks, values, res, true);
    }
);

//endregion getAll

//region searches

/**
 * @api {get} /books/search
 *
 * @apiDescription Request to retrieve a list of books that match all the query parameters entered.
 * If parameter q is entered, it means it will search by keyword and all other parameters will not
 * make effect. It is possible that no book will be retrieved because no match is found, or multiple
 * books are retrieved because more than one match is found. Though query parameters are optional, at
 * least one parameter must be entered. If one of min or max is entered without another, it will set
 * the missing parameter to its default value 1 (for min) or 5 (for max).
 *
 * @apiName SearchByParameter
 * @apiGroup Books
 *
 * @apiQuery {String} [title] The title of the book to search for.
 * @apiQuery {Number} [isbn] The ISBN of the book to search for.
 * @apiQuery {String} [author] The author's first and/or last name.
 * @apiQuery {Number{1-5}} [min] The minimum rating.
 * @apiQuery {Number{1-5}} [max] The maximum rating.
 *
 * @apiSuccess (200 Success) {Array<IBook>} books A list of books match the parameters entered.
 *
 * @apiError (400 No parameter) {String} message "Search required at least one query parameter."
 * @apiError (400 Invalid ISBN) {String} message "The ISBN in the request is not numeric."
 * @apiError (400 Invalid ISBN) {String} message "The ISBN in the request is not 13 digits long."
 * @apiError (400 Invalid Min/Max) {String} message "Min is not numeric or is greater than 5."
 * @apiError (400 Invalid Min/Max) {String} message "Max is not numeric or is less than 1."
 * @apiError (400 Invalid Min/Max) {String} message "Min is greater than max."
 * @apiError (400 Blank parameter) {String} message "Title cannot be blank."
 * @apiError (400 Blank parameter) {String} message "ISBN cannot be blank."
 * @apiError (400 Blank parameter) {String} message "Author cannot be blank."
 * @apiError (500 Internal server error) {String} message "Server error - Contact Support."
 */
bookRouter.get(
    '/search',
    (req: Request, res: Response, next: NextFunction) => {
        if (Object.keys(req.query).length > 0) {
            next();
        } else {
            res.status(400).send({
                message: 'Search required at least one query parameter.',
            });
        }
    },
    (req: Request, res: Response, next: NextFunction) => {
        if (!req.query.q) {
            if (!res.writableEnded && req.query.title) validTitle(req, res);
            if (!res.writableEnded && req.query.isbn) validISBN(req, res);
            if (!res.writableEnded && req.query.author) validAuthor(req, res);
            if (!res.writableEnded && (req.query.min || req.query.max))
                validMinMax(req, res);
        }
        if (String(res.statusCode).startsWith('2')) next();
    },
    (req: Request, res: Response) => {
        let getBooks = `${getBooksAndAuthorsQuery} WHERE`;
        let count = 1;
        const values = [];
        if (!req.query.q) {
            // If isbn entered, append query for ISBN
            if (req.query.isbn) {
                if (!getBooks.endsWith('WHERE'))
                    getBooks = getBooks.concat(' AND');
                getBooks = getBooks.concat(` isbn13 = $${count++}`);
                values.push(String(req.query.isbn));
            }

            // If title entered, append query for title
            if (req.query.title) {
                if (!getBooks.endsWith('WHERE'))
                    getBooks = getBooks.concat(' AND');
                getBooks = getBooks.concat(` (title LIKE $${count++} 
                            OR title LIKE $${count++} OR DIFFERENCE(title, $${count++}) > 2)`);
                values.push(
                    String(req.query.title),
                    String(req.query.title).charAt(0).toUpperCase() +
                        String(req.query.title).slice(1),
                    String(req.query.title)
                );
            }

            // If author entered, append query for author
            if (req.query.author) {
                if (!getBooks.endsWith('WHERE'))
                    getBooks = getBooks.concat(' AND');
                getBooks = getBooks.concat(` authors LIKE $${count++}`);
                values.push(String('%' + req.query.author + '%'));
            }

            // If min and/or max entered, append query for min and/or max rating
            if (req.query.min || req.query.max) {
                if (!getBooks.endsWith('WHERE'))
                    getBooks = getBooks.concat(' AND');
                getBooks = getBooks.concat(
                    ` rating_avg BETWEEN $${count++} AND $${count++}`
                );
                values.push(String(req.query.min), String(req.query.max));
            }
        }
        queryAndResponse(getBooks, values, res, false);
    }
);

/**
 * @api {get} /book/search
 *
 * @apiDescription Performs a keyword search of all books in the database checking for title or author matches. May only contain alphanumeric characters, no white space or special characters. ex: "this+is+a+valid+query".
 *
 * @apiName getKwSearch
 * @apiGroup open
 *
 * @apiParam {string} q A web search formatted query. May use - to exclude terms or place words in quotes to require an exact match. ex: This is a "valid" -query
 *
 * @apiSuccess (200) {Array<IBook>} returns an array containing all matching books
 * @apiSuccess (204) {String} The query was successfully run, but no books were found.
 *
 * @apiError (400: Bad Request) {String} Client provided no or malformed query parameter.
 * @apiError (418: I'm a teapot) {String} Client requested server to make coffee, but only tea is available.
 *
 */
bookRouter.get(
    '/search',
    checkQueryHasString,
    checkQueryFormat,
    async (req: Request, res: Response, next: NextFunction) => {
        const query = `SELECT *, ts_rank(kw_vec, websearch_to_tsquery('english', $1)) AS rank, get_authors(id) AS authors
                       FROM books
                       WHERE kw_vec @@ websearch_to_tsquery('english', $1)
                       ORDER BY rank DESC`;
        const ans = await pool.query(query, [req.query.q]);

        res.setHeader('Content-Type', 'application/json').send(
            resultToIBook(ans)
        );
    }
);

/**
 * @api {put} /books
 *
 * @apiDescription Allows an authenticated user to update a book's information.
 *   Retrieves the book to be updated with the ISBN.
 *
 * @apiName UpdateBook
 * @apiGroup books
 *
 * @apiParam {Int} isbn-13 The ISBN of the book to be updated.
 * @apiParam {String} attribute The attribute of the book that will be updated.
 * @apiParam {String} newInfo The information to update the book with.
 *
 * @apiSuccess (200: Success) {String} Book updated successfully.
 *
 * @apiError (400: Bad request) {String} message Missing parameter(s).
 * @apiError (401: Unauthorized) {String} message User does not have permission to update books.
 * @apiError (500: Internal server error) {String} message Server or database error occurred.
 */
// method goes here

//endregion searches

export { bookRouter };
