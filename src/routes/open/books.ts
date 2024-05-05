//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
import { parameterChecks } from '../../core/middleware';
import { IRatings, IUrlIcon, IBook } from '../../core/models';

const bookRouter: Router = express.Router();

const validSort = parameterChecks.validSort;
const validOffset = parameterChecks.validOffset;
const validPage = parameterChecks.validPage;

/**
 * Create a IBook object using the given data. This function assume the data contains all
 * information required to create a IBook objct and the name of each information is same as
 * column name in the table.
 *
 * @param data The information about the book.
 * @returns A IBook object created from the data.
 */
const createIBook = (data: any): IBook => {
    // Get rating of the current book
    const rating: IRatings = {
        average: data.rating_avg,
        count: data.rating_count,
        rating_1: data.rating_1_star,
        rating_2: data.rating_2_star,
        rating_3: data.rating_3_star,
        rating_4: data.rating_4_star,
        rating_5: data.rating_5_star,
    };
    // Get image url of the current book
    const icon: IUrlIcon = {
        large: data.image_url,
        small: data.image_small_url,
    };
    // Create a IBook object for the current book
    const book: IBook = {
        isbn13: data.isbn13,
        authors: data.authors,
        publication: data.publication_year,
        original_title: data.original_title,
        title: data.title,
        ratings: rating,
        icons: icon,
    };
    return book;
};

/**
 * @api {get} /books/all/title?sort=:sort&offset=:offset&page=:page
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
            .then((result) => {
                if (result.rowCount > 0) {
                    const books: IBook[] = [];
                    result.rows.forEach((row) => {
                        books.push(createIBook(row));
                    });
                    res.status(200).send({
                        books: books,
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
 * @api {get} /books/all/author?sort=:sort&offset=:offset&page=:page
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
 */

/**
 * @api {get} /books/title?title=:title
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
 */

/**
 * @api {get} /books/isbn?isbn=:isbn
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
 */

export { bookRouter };
