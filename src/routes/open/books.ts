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

const getBooksAndAuthorsQuery = `
    SELECT * FROM books INNER JOIN 
    (SELECT book, STRING_AGG(authors.name, ', ') AS authors FROM book_author INNER JOIN 
        authors ON (authors.id = book_author.author)GROUP BY book) AS author_table
    ON (books.id = author_table.book)`;

//region Post/Delete
/**
 * @api {post} /books Request to add a new book
 *
 * @apiDescription This api allows an authenticated user with the correct permission to add a new book in the database,
 * with all the required information.
 *
 * @apiName PostAddBook
 * @apiGroup books
 *
 * @apiBody {number} id The added book's id
 * @apiBody {number} isbn-13 An identifier of the book
 * @apiBody {string} authors The creator of the book can have more than one
 * @apiBody {number} publication year A number that shows when the book was published
 * @apiBody {string} original_title Name the book was first given
 * @apiBody {string} title Another name for the book
 * @apiBody {number} average rating The average amount of rate from 1-5
 * @apiBody {number} ratings count total amount of time the book was rated
 * @apiBody {number} rating_1 Number of 1-star rating on this book.
 * @apiBody {number} rating_2 Number of 2-star rating on this book.
 * @apiBody {number} rating_3 Number of 3-star rating on this book.
 * @apiBody {number} rating_4 Number of 4-star rating on this book.
 * @apiBody {number} rating_5 Number of 5-star rating on this book.
 * @apiBody {string} image_url The url of the image
 * @apiBody {string} small_image_url The url of the small image of the book
 *
 *
 *
 * @apiSuccess (201) {String} Success new book was added to the database
 *
 * @apiError (400: missing parameter) {String} message "Required information for new book is missing"
 * @apiError (403: unauthorized user) {String} message "You do not have access to add book"
 * @apiError (401: permission denied) {String} message "You do not have permission to add book"
 */

/**
 * @api {delete} /books Request to delete a book
 *
 * @apiDescription Deletes a single book from the database by ID or the ISBN.
 *
 * @apiName DeleteBook
 * @apiGroup books
 *
 * @apiParam {Number} id The primary key ID of the book to delete
 * @apiParam {Number} isbn The isbn of the book to delete
 *
 * @apiSuccess (200) {String} Success book was deleted!
 *
 * @apiError (404) {String} message "No books found matching the criteria"
 * @apiError (401) {String} message "No permission to delete books"
 * @apiError (403) {String} message "Unauthorized user"
 */
//There is duplicate ISBN numbers in the database which will cause to crash!!!!!
bookRouter.delete('/deleteBook/:isbn', (req: Request, res: Response, next: NextFunction) => {
    const isbn = req.params.isbn;
    // fixes this error update or delete on table "books" violates foreign key constraint "book_author_book_fkey" on table "book_author"
    pool.query('DELETE FROM book_author WHERE book = (SELECT id FROM books WHERE isbn13 = $1)', [isbn])
        .then(() => {
            return pool.query('DELETE FROM books WHERE isbn13 = $1', [isbn]);
        })
        .then(() => {
            res.status(200).send({
                message: 'Deleted book.'
            });
        })
        .catch((error) => {
            console.error(`Server failed to delete book due to ${error}`);
            res.status(500).send('Server error, so sorry!');
        });
});


/**
 * @api {delete} /books Request to delete a range of books
 *
 * @apiDescription This deletes a range of books within a minimum book ID and maximum book ID
 * inclusively.
 *
 * @apiName DeleteRangeBooks
 * @apiGroup books
 *
 * @apiParam {Number} min_id The minimum ID of the range
 * @apiParam {Number} max_id the maximum ID of the range
 *
 * @apiSuccess (200) {String} Success: Range of books deleted!
 *
 * @apiError (404) {String} message "No books found matching the criteria"
 * @apiError (401) {String} message "No permission to delete books"
 * @apiError (403) {String} message "Unauthorized user"
 */
bookRouter.delete('/deleteRangeBooks/:min_id/:max_id', (req: Request, res: Response, next: NextFunction) => {
    const { min_id, max_id } = req.params;
    const query = 'DELETE FROM book_author WHERE book IN (SELECT id FROM books WHERE id >= $1 AND id <= $2);';
    pool.query(query, [min_id, max_id])
        .then(() => {
            const deleteBooksQuery = 'DELETE FROM books WHERE id >= $1 AND id <= $2;';
            return pool.query(deleteBooksQuery, [min_id, max_id]);
        })
        .then(() => {
            res.status(200).send({
                message: 'Deleted range of books.'
            });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Server error, so sorry!');
        });
});

//endregion Post/Delete

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
 * @apiQuery {string="title","author","year"} orderby="title" The specified attribute of the book that it use
 * sort books.
 * @apiQuery {string="asc","desc"} sort="asc" The order of the book. It can be "asc" for ascending or "desc"
 * for descending.
 * @apiQuery {number} offset=15 The number of books display per page.
 * @apiQuery {number} page=1 The page number that starts from one.
 *
 * @apiSuccess (200 Success) {IBook[]} books A list of books in the given page.
 *
 * @apiError (400 Invalid page) {string} message "The page number in the request is not numeric."
 * @apiError (400 Invalid offset) {string} message "The offset in the request is not numeric."
 * @apiError (400 No book found) {string} message "Unexpected error - cannot retrieve books."
 * @apiError (500 Internal server error) {string} message "Server error."
 */
bookRouter.get(
    '/all',
    validOrderby,
    validSort,
    validOffset,
    validPage,
    (req: Request, res: Response) => {
        const orderQuery = {
            title: 'title ',
            author: 'author_table.author ',
            year: 'publication_year, title ',
        };
        const offset = Number(req.query.offset);
        const page = Number(req.query.page);
        const getBooks = `${getBooksAndAuthorsQuery} ORDER BY $1 OFFSET $2 LIMIT $3;`;
        const values = [
            orderQuery[String(req.query.orderby)] + String(req.query.sort),
            String(offset * (page - 1)),
            String(req.query.offset),
        ];
        queryAndResponse(getBooks, values, res, true);
    }
);

/**
 * @api {get} /books/all
 *
 * @apiDescription Request to retrieve all books sorted by publication date.
 *   If there are multiple books published on the same date, those books are then
 *   sorted by title in descending alphabetical order (A to Z). Uses pagination,
 *   where offset is the number of books per page. A negative/zero offset will
 *   be converted to positive. A page less than one will redirect to the first
 *   page. A page number larger than the maximum will redirect to the maximum
 *   page.
 *
 * @apiName GetAllByPub
 * @apiGroup books
 *
 * @apiQuery {String = "asc", "desc"} sort="asc" The order of the book. Use "asc"
 *   for ascending and "desc" for descending.
 * @apiQuery {Number} offset=15 The number of books displayed per page. Default
 *   is 15.
 * @apiQuery {Number} page=1 The page number. Default is 1.
 *
 * @apiSuccess (200: Success) {Array<IBook>} Returns an array of all books sorted by publication date.
 *
 * @apiError (500: Internal server error) {String} message Server or database error occurred.
 */
// method goes here

//endregion getAll

//region searches

/**
 * @api {get} /books/search
 *
 * @apiDescription Request to retrieve a list of books that match all the query parameters entered.
 * If parameter q is entered, it means it will search by keyword and all other parameters will not
 * make effect. It is possible that no book will be retrieved because no match is found, or multiple
 * books are retrieved because more than one match is found. Though query parameters are optional, at
 * least one parameter must be entered.
 *
 * @apiName SearchByParameter
 * @apiGroup Books
 *
 * @apiParam {string} [q] The keywords to search the database for.
 * @apiQuery {string} [title] The title of the book to search for.
 * @apiQuery {number} [isbn] The ISBN of the book to search for.
 * @apiQuery {string} [author] The author's first and/or last name.
 * @apiQuery {Number} [min] The minimum rating.
 * @apiQuery {Number} [max] The maximum rating.
 *
 * @apiSuccess (200 Success) {IBook[]} books A list of books match the parameters entered.
 *
 * @apiError (400 No parameter) {string} message "Search required at least one query parameter."
 * @apiError (400 Invalid ISBN) {string} message "The ISBN in the request is not numeric."
 * @apiError (400 Invalid ISBN) {string} message "The ISBN in the request is not 13 digits long."
 * @apiError (400 Blank parameter) {String} message "Title cannot be blank."
 * @apiError (400 Blank parameter) {String} message "ISBN cannot be blank."
 * @apiError (500 Internal server error) {string} message "Server error."
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
        if (req.query.q) {
            // This is a placeholder for keyword search
            console.log();
        } else {
            if (req.query.title) validTitle(req, res);
            if (req.query.isbn) validISBN(req, res);

            // temporary checks -- will write into parameterChecks.ts
            if(req.query.author && ((String(req.query.author).trim().length < 1))) {
                res.status(400).send({}) // no chars in author name
            }
            if(req.query.min && isNaN(Number(req.query.min)) || Number(req.query.min) > 5) {
                res.status(400).send({}) // min not a num or over 5
            }
            if(req.query.max && isNaN(Number(req.query.max)) || Number(req.query.max) < 0) {
                res.status(400).send({}) // max not a num or less than 0
            }
            if(req.query.min && req.query.max && Number(req.query.min) > Number(req.query.max)) {
                res.status(400).send({}) // min > max
            }
        }
        if (String(res.statusCode).startsWith('2')) next();
    },
    (req: Request, res: Response) => {
        let getBooks = `${getBooksAndAuthorsQuery} WHERE`;
        let count = 1;
        const values = [];
        if (req.query.q) {
            // This is a placeholder for keyword search
            console.log();
        } else {
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
                values.push(
                    String(`%` + req.query.author + `%`)
                );
            }

            // If min and/or max entered, append query for min and/or max rating
            if (req.query.min || req.query.max) {
                if (!getBooks.endsWith('WHERE'))
                    getBooks = getBooks.concat(' AND');

                let lowerLimit = 0;
                let upperLimit = 5;
                if (req.query.min) {
                    lowerLimit = Number(req.query.min);
                }
                if (req.query.max) {
                    upperLimit = Number(req.query.max);
                }

                getBooks = getBooks.concat(` rating_avg BETWEEN $${count++} AND $${count++}`);
                values.push(
                    String(lowerLimit),
                    String(upperLimit)
                );
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
 * @api {get} /books/search
 *
 * @apiDescription Request to search and retrieve all books with the specified
 *   author. A book with multiple authors will still be retrieved if one author
 *   matches the name searched.
 *
 * @apiName GetBooksByAuthor
 * @apiGroup books
 *
 * @apiQuery author The author's first and/or last name
 *
 * @apiSuccess (200: Success) {Array<IBook>} Returns an array of all books with the author specified in input.
 *
 * @apiError (400: Bad request) {String} message Missing parameter - Author name required.
 * @apiError (500: Internal server error) {String} message Server or database error occurred.
 */
bookRouter.get('/search', (req: Request, res: Response) => {
    const author = req.query.authorn;
    const query = `SELECT * FROM books WHERE id IN ( SELECT book FROM book_author WHERE author IN ( SELECT authors.id FROM authors WHERE name LIKE $1 ) ) ORDER BY title asc;`;

    // Currently does not work -- gives empty array of books.
    pool.query(query, [`'%${author}%'`])
        .then((result) => {
            res.status(200).send({
                books: result.rows.map((row: IBook) => row as IBook),
            });
        })
        .catch((e) => {
            console.log(`Server failed to get books due to ${e}`);
            res.status(500).send('Error while performing database query.');
        });
});

/**
 * @api {get} /books/search
 *
 * @apiDescription Request to search and retrieve all books that have a rating
 *   that is within the given rating range (inclusive).
 *
 * @apiName GetBooksByRating
 * @apiGroup books
 *
 * @apiQuery {Number} min The minimum rating.
 * @apiQuery {Number} max The maximum rating.
 *
 * @apiSuccess (200: Success) {Array<IBook>} Returns an array of all books that
 *   have a rating within the given range.
 *
 * @apiError (400: Bad request) {String} message Missing parameter(s) - Min and Max rating
 *   required.
 * @apiError (500: Internal server error) {String} message Server or database error occurred.
 */
bookRouter.get('/search/rating', (req: Request, res: Response) => {
    const min = Number(req.query.min);
    const max = Number(req.query.max);
    const query = `SELECT * FROM books WHERE rating_avg BETWEEN $1 AND $2 ORDER BY title ASC;`;

    if(isNaN(min) || isNaN(max)) {
        res.status(400).send({
            message: 'Missing parameter(s) - Min and Max rating required.',
        });
    }

    if(min < 0 || min > 5 || max < 0 || max > 5) {
        res.status(400).send({
            message: 'Min or max is out of bounds (must be [0, 5])',
        });
    }

    if(min > max) {
        res.status(400).send({
            message: 'Min is greater than max.',
        });
    }

    pool.query(query, [min, max])
        .then((result) => {
            res.status(200).send({
                books: result.rows.map((row: IBook) => row as IBook),
            });
        })
        .catch((e) => {
            console.log(`Server failed to find books due to ${e}`);
            res.status(500).send('Error while performing database query.');
        });
});

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
