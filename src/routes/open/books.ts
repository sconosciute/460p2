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

// Part of the query that retrieves books with their authors
const getBooksAndAuthorsQuery = `
    SELECT *
    FROM books
             INNER JOIN
         (SELECT book, STRING_AGG(authors.name, ', ') AS authors
          FROM book_author
                   INNER JOIN
               authors ON (authors.id = book_author.author)
          GROUP BY book) AS author_table
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
    allBooks: boolean,
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
 *
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
 * Confirms a query is formatted correctly to perform a keyword search and does not contain additional symbols.
 *
 * @param req HTTP Request
 * @param res HTTP Response
 * @param next Next Middleware Function
 */
const checkKwQueryFormat = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    if (!req.query.q) {
        next();
    } else if (!validationFunctions.isStringProvided(req.query.q)) {
        res.status(400).send({
            message: 'Keyword query q must be a string.',
        });
    } else {
        const queryPattern = /^[a-zA-Z0-9\s"-]+$/gm;
        console.log(`query: ${req.query.q}`);
        const check = (<string>req.query.q).match(queryPattern);
        console.dir(check);
        if (check?.length != 1) {
            res.status(400).send({
                message:
                    'Malformed query\n Keyword query q must be a web search format and may include alphanumeric characters as well as - and "',
            });
        } else {
            next();
        }
    }
};

/**
 * Check whether the given request contains at least on query parameter.
 *
 * @param req HTTP Request
 * @param res HTTP Response
 * @param next Next Middleware Function
 */
const checkHasQuery = (req: Request, res: Response, next: NextFunction) => {
    if (Object.keys(req.query).length > 0) {
        console.log(
            '\n\nRECEIVED QUERY============================================================',
        );
        console.dir(req.query);
        next();
    } else {
        res.status(400).send({
            message: 'Search requires at least one query parameter.',
        });
    }
};

/**
 * Perform keyword search on the given keywork q in the request and send the resulting books in response.
 *
 * @param req HTTP Request
 * @param res HTTP Response
 * @param next Next Middleware Function
 */
const performKeywordSearch = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    if (!req.query.q) {
        next();
    } else {
        const query = `SELECT *,
                              ts_rank(kw_vec, websearch_to_tsquery('english', $1)) AS rank,
                              get_authors(id)                                      AS authors
                       FROM books
                       WHERE kw_vec @@ websearch_to_tsquery('english', $1)
                       ORDER BY rank DESC`;
        const ans = await pool.query(query, [req.query.q]);

        res.setHeader('Content-Type', 'application/json').send({
            books: resultToIBook(ans),
        });
    }
};

//endregion middleware

/**
 * @apiDefine IBookFormat
 * @apiSuccessExample
 *      {
 *          books: [
 *              isbn13: 9780439023480,
 *              authors: "Suzanne Collins",
 *              publication: 2008,
 *              original_title: "The Hunger Games",
 *              title: "The Hunger Games (The Hunger Games, #1)",
 *              ratings: {
 *                  average: 4.34,
 *                  count: 4780653,
 *                  rating_1: 66715,
 *                  rating_2: 127936,
 *                  rating_3: 560092,
 *                  rating_4: 1481305,
 *                  rating_5: 2706317,
 *              },
 *              icons: {
 *                  large: "https://images.gr-assets.com/books/1447303603m/2767052.jpg",
 *                  small: "https://images.gr-assets.com/books/1447303603s/2767052.jpg",
 *              },
 *          ]
 *      }
 */

//region getAll

/**
 * @api {get} /books/all?orderby=:orderby&sort:=sort&offset:=offset&page:=page
 * Get all books sorted by a certain attribute of the book.
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
 * @apiSuccess (200: Success) {IBook[]} books A list of books in the given page.
 * @apiUse IBookFormat
 *
 * @apiError (400: Invalid page) {String} message "The page number in the request is not numeric."
 * @apiError (400: Invalid offset) {String} message "The offset in the request is not numeric."
 * @apiError (400: No book found) {String} message "Unexpected error - cannot retrieve books."
 * @apiError (500: Server error) {String} message "Server error - Contact Support."
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
    },
);

//endregion getAll

//region searches

/**
 * @api {get} /books/search?offset:=offset&page:=page
 * Get specific book(s) based on the search query passed to the method.
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
 * @apiQuery {String} [q] Web search formatted keywords to search for. May include alphanumeric characters as well as - and ". Providing this parameter will perform a keyword search and ignore other parameters.
 * @apiQuery {String} [title] The title of the book to search for.
 * @apiQuery {Number} [isbn] The ISBN of the book to search for.
 * @apiQuery {String} [author] The author's first and/or last name.
 * @apiQuery {Number{1-5}} [min] The minimum rating. Will be clamped between 1-5, malformed input
 * will be treated as 1.
 * @apiQuery {Number{1-5}} [max] The maximum rating. Will be clamped between 1-5, Malformed input
 * will be treated as 5.
 * @apiQuery {Number} offset=15 The number of books display per page.
 * @apiQuery {Number} page=1 The page number that starts from one.
 *
 * @apiSuccess (200: Success) {IBook[]} books A list of books match the parameters entered.
 * @apiUse IBookFormat
 *
 * @apiError (400: Invalid page) {String} message "The page number in the request is not numeric."
 * @apiError (400: Invalid offset) {String} message "The offset in the request is not numeric."
 * @apiError (400: No parameter) {String} message "None of the required parameter is entered."
 * @apiError (400: Invalid ISBN) {String} message "The ISBN in the request is not numeric."
 * @apiError (400: Invalid ISBN) {String} message "The ISBN in the request is not 13 digits long."
 * @apiError (400: Invalid Min/Max) {String} message "Min is greater than max."
 * @apiError (400: Blank parameter) {String} message "Title cannot be blank."
 * @apiError (400: Blank parameter) {String} message "ISBN cannot be blank."
 * @apiError (400: Blank parameter) {String} message "Author cannot be blank."
 * @apiError (500: Server error) {String} message "Server error - Contact Support."
 */
bookRouter.get(
    '/search',
    checkHasQuery,
    checkKwQueryFormat,
    performKeywordSearch,
    validOffset,
    validPage,
    validTitle,
    validISBN,
    validAuthor,
    validMinMax,
    (req: Request, res: Response) => {
        let valIndex = 1;
        const values = [];
        const wheres = [];

        if (req.query.isbn) {
            wheres.push(`isbn13 = $${valIndex++}`);
            values.push(String(req.query.isbn));
        }

        // If title entered, append query for title
        if (req.query.title) {
            wheres.push(
                `(title LIKE $${valIndex++} OR title LIKE $${valIndex++} OR DIFFERENCE(title, $${valIndex++}) > 2)`,
            );
            values.push(
                String(req.query.title),
                String(req.query.title).charAt(0).toUpperCase() +
                String(req.query.title).slice(1),
                String(req.query.title),
            );
        }

        // If author entered, append query for author
        if (req.query.author) {
            wheres.push(`authors LIKE $${valIndex++}`);
            values.push(String('%' + req.query.author + '%'));
        }

        // If min and/or max entered, append query for min and/or max rating
        if (req.query.min && req.query.max) {
            wheres.push(`rating_avg BETWEEN $${valIndex++} AND $${valIndex++}`);
            values.push(String(req.query.min), String(req.query.max));
        }

        const where = wheres.join(' AND ');
        if (where.length < 1) {
            res.status(400).send({
                message:
                    'Failed to parse query, please make sure input is provided and well formed.',
            });
        } else {
            const query = `${getBooksAndAuthorsQuery} WHERE ${where} OFFSET $${valIndex++} LIMIT $${valIndex++}`;
            const offset = Number(req.query.offset);
            const page = Number(req.query.page);
            values.push(String(offset * (page - 1)), String(req.query.offset));
            queryAndResponse(query, values, res, false);
        }
    },
);

export { bookRouter };
