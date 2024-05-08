//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
import { parameterChecks } from '../../core/middleware';
import { IRatings, IUrlIcon, IBook } from '../../core/models';
import { QueryResult } from 'pg';

const bookRouter: Router = express.Router();

const validSort = parameterChecks.validSort;
const validOffset = parameterChecks.validOffset;
const validPage = parameterChecks.validPage;

/**
 * @api {get} /books/all/title
 *
 * @apiDescription Request to retrieve all information about all books in a certain page sorted by title.
 * The number of books display per page is specified by offset. The offset and page must be numeric. If a
 * negative or zero offset is entered, it will be converted to positive. If the page is less than 1 or greater
 * than the maximum number of page, it will redirect to the first or last page.
 *
 * @apiName GetAllByTitle
 * @apiGroup Books
 *
 * @apiQuery {string="asc","desc"} sort="asc" The order of the book. It can be "asc" for ascending or "desc"
 * for descending.
 * @apiQuery {number} offset=15 The number of books display per page.
 * @apiQuery {number} page=1 The page number that starts from one.
 *
 * @apiSuccess (200 Success) {IBook[]} books A list of books in the given page.
 *
 * @apiError (400 Invalid page) {string} message "The page number in the request is not numberic."
 * @apiError (400 Invalid offset) {string} message "The offset in the request is not numberic."
 * @apiError (400 No book found) {string} message "Database error occurs while retrieving books."
 * @apiError (500 Internal Server Error) {string} message "Server error."
 */
bookRouter.get(
    '/all/title',
    validSort,
    validOffset,
    validPage,
    (req: Request, res: Response) => {
        // Query used to retrieve all books
        const offset = Number(req.query.offset);
        const page = Number(req.query.page);
        const getBooks = `SELECT * FROM books INNER JOIN 
            (SELECT book, STRING_AGG(authors.name, ', ') AS authors FROM book_author
                INNER JOIN authors ON (authors.id = book_author.author)
                GROUP BY book) AS author_table
            ON (books.id = author_table.book)
            ORDER BY title ${req.query.sort} OFFSET $1 LIMIT $2;`;
        const values = [offset * (page - 1), offset];

        pool.query(getBooks, values)
            .then((result: QueryResult<IBook>) => {
                if (result.rowCount > 0) {
                    res.status(200).send({
                        books: result.rows.map((row: IBook) => row as IBook),
                    });
                } else {
                    console.error('Error occurs while retrieving books.');
                    res.status(400).send({
                        message: 'Error occurs while retrieving books.',
                    });
                }
            })
            .catch((error) => {
                console.error('DB query error when retriving all books.');
                console.error(error);
                res.status(500).send({
                    message: 'Server error.',
                });
            });
    }
);

/**
 * @api {get} /books/all/author
 *
 * @apiDescription Request to retrieve all information about all books in a certain page sorted by author.
 * If a book has multiple authors, use the author name that comes first in alphabet. The number of books
 * display per page is specified by offset. The offset and page must be numeric. If a negative or zero offset is
 * entered, it will be converted to positive. If the page is less than 1 or greater than the maximum number
 * of page, it will redirect to the first or last page.
 *
 * @apiName GetAllByAuthor
 * @apiGroup Books
 *
 * @apiQuery {string="asc","desc"} sort="asc" The order of the book. It can be "asc" for ascending or "desc"
 * for descending.
 * @apiQuery {number} offset=15 The number of books display per page.
 * @apiQuery {number} page=1 The page number that starts from one.
 *
 * @apiSuccess (200 Success) {IBook[]} books A list of books in the given page.
 *
 * @apiError (400 Invalid page) {string} message "The page number in the request is not numberic."
 * @apiError (400 Invalid offset) {string} message "The offset in the request is not numberic."
 * @apiError (400 No book found) {string} message "Database error occurs while retrieving books."
 * @apiError (500 Internal Server Error) {string} message "Server error."
 */

/**
 * @api {get} /books/title
 *
 * @apiDescription Request to retrieve a list of books by title. It is possible that no book will be
 * retrieved because no match is found, or multiple books are retrieved because more than one match
 * is found. The title can be found by both title and original title.
 *
 * @apiName GetByTitle
 * @apiGroup Books
 *
 * @apiQuery {string} title The title of the book to search for.
 *
 * @apiSuccess (200 Success) {IBook[]} books A list of books with title that are similar to the title to search for.
 *
 * @apiError (400 Bad request) {String} message Missing parameter - Title required.
 * @apiError (500 Internal Server Error) {string} message "Server error."
 */

/**
 * @api {get} /books/isbn
 *
 * @apiDescription Request to retrieve a list of books by ISBN. It is possible that no book will be
 * retrieved because no match is found, or multiple books are retrieved because more than one match
 * is found.
 *
 * @apiName GetByISBN
 * @apiGroup Books
 *
 * @apiQuery {number} isbn The ISBN of the book to search for.
 *
 * @apiSuccess (200 Success) {IBook[]} books A list of books with given ISBN.
 *
 * @apiError (400 Invalid ISBN) {string} message "The ISBN in the request is not numberic."
 * @apiError (400 Invalid ISBN) {string} message "The ISBN in the request is not 13 digits long."
 * @apiError (400 Bad request) {String} message Missing parameter - ISBN required.
 * @apiError (500 Internal Server Error) {string} message "Server error."
 */

/**
 * @api {get} kwSearch
 *
 * @apiDescription Performs a keyword search of all books in the database by title and author.
 *
 * @apiName prefer getKwSearch
 * @apiGroup open
 *
 * @apiParam {string} q The keywords to search the database for.
 *
 * @apiSuccess (200) {Array<IBook>} returns an array containing all matching books
 * @apiSuccess (204) {String} The query was successfully run, but no books were found.
 *
 * @apiError (400: Bad Request) {String} Client provided no or malformed query parameter.
 * @apiError (418: I'm a teapot) {String} Client requested server to make coffee, but only tea is available.
 *
 */
bookRouter.get('/search', (req: Request, res: Response, next: NextFunction) => {
    console.log('Somebody tried to search!');
    res.status(501).send();
});

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
// method goes here

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
// method goes here

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

export { bookRouter };
