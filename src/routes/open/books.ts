//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

const isNumberProvided = validationFunctions.isNumberProvided;

interface IRatings {
    average: number;
    count: number;
    rating_1: number;
    rating_2: number;
    rating_3: number;
    rating_4: number;
    rating_5: number;
}

interface IUrlIcon {
    large: string;
    small: string;
}

interface IBook {
    isbn13: number;
    authors: string;
    publication: number;
    original_title: string;
    title: string;
    ratings: IRatings;
    icons: IUrlIcon;
}

/**
 * Check whether the query parameters are valid. If not send error with response or change it to valid value.
 * Conditions to send error:
 * - The given offset or page is not numeric value.
 * Conditions to change value:
 * - The given sort parameter is empty or neither 'asc' or 'desc'; change it to 'asc'.
 * - The given offset is negative; change it to positive as absolute value.
 * - The given offset is zero; change it to default value 15.
 * - The given page is less than 1; change it to 1;
 * - The given page is greater than the maximum number of page with given offset; change to maximum page number.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next function.
 */
const validParameters = (req: Request, res: Response, next: NextFunction) => {
    // If invalid or none way of sort is entered, change it to default value.
    if (
        !req.query.sort ||
        (req.query.sort != 'asc' && req.query.sort != 'desc')
    ) {
        req.query.sort = 'asc';
    }
    // Set default value for offset and page if not passed by parameters.
    req.query.offset = req.query.offset ? req.query.offset : '15';
    req.query.page = req.query.page ? req.query.page : '1';
    // Check if the value of offset and page is valid. If not, change it to a valid number.
    if (
        isNumberProvided(req.query.offset) &&
        isNumberProvided(req.query.page)
    ) {
        let validOffset: number = Math.abs(Number(req.query.offset));
        let validPage: number = Number(req.query.page);

        // Make sure offset is not zero
        if (validOffset < 1) {
            validOffset = 15;
        }

        // Get maximum number of page and check if page is valid.
        const theQuery = `SELECT COUNT(id) AS count FROM books GROUP BY id`;
        pool.query(theQuery)
            .then((result) => {
                const maxPage = Math.ceil(result.rows[0].count / validOffset);
                if (validPage > maxPage) {
                    validPage = maxPage;
                } else if (validPage < 1) {
                    validPage = 1;
                }
            })
            .catch((error) => {
                console.error(
                    'DB query error when counting the number of books.'
                );
                console.error(error);
                res.status(500).send({
                    message: 'Server error.',
                });
            });

        // Update valid offset and page
        req.query.offset = validOffset.toString();
        req.query.page = validPage.toString();
        next();
    } else {
        console.error('The page number or offset is not numberic.');
        res.status(400).send({
            message:
                'The page number or offset you passed through the request is not numberic.',
        });
    }
};

/**
 * Get all authors of the given book as one string.
 *
 * @param id The id of the book.
 * @param res The HTTP response.
 * @returns All authors of the book.
 */
const getAuthors = async (id: number, res: Response): Promise<string> => {
    const getAuthors = `SELECT authors.name AS authorname FROM authors INNER JOIN book_author 
        ON (authors.id = book_author.author) WHERE book_author.book = ${id}`;
    const authors: string[] = [];
    try {
        const result = await pool.query(getAuthors);
        result.rows.forEach((element) => {
            authors.push(element.authorname.toString());
        });
    } catch (error) {
        console.error('DB query error on getting authors of a book.');
        console.error(error);
        res.status(500).send({
            message: 'Server error.',
        });
    }
    return authors.join(', ');
};

/**
 * Create a IBook object using the given data. This function assume the data contains all
 * information required to create a IBook objct and the name of each information is same as
 * column name in the table.
 *
 * @param data The information about the book.
 * @param res The HTTP response.
 * @returns A IBook object created from the data.
 */
const createIBook = async (data: any, res: Response): Promise<IBook> => {
    // Get rating of the current book
    const rating: IRatings = {
        average: data.rating_avg,
        count: data.rating_count,
        rating_1: data.rating_1_start,
        rating_2: data.rating_2_start,
        rating_3: data.rating_3_start,
        rating_4: data.rating_4_start,
        rating_5: data.rating_5_start,
    };
    // Get image url of the current book
    const icon: IUrlIcon = {
        large: data.image_url,
        small: data.image_small_url,
    };
    // Create a IBook object for the current book
    const book: IBook = {
        isbn13: data.isbn13,
        authors: await getAuthors(data.id, res),
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
 * @apiError (400 Invalid page or offset) {string} message "The page number or offset in the request is not numberic."
 * @apiError (400 No book found) {string} message "Database error occurs while retrieving books."
 */
bookRouter.get('/all/title', validParameters, (req: Request, res: Response) => {
    // Query used to retrieve all books
    const offset = Number(req.query.offset);
    const page = Number(req.query.page);
    const getBooks = `SELECT * FROM books ORDER BY title ${req.query.sort} OFFSET $1 LIMIT $2`;
    const values = [offset * (page - 1), offset];

    pool.query(getBooks, values)
        .then(async (result) => {
            if (result.rowCount > 0) {
                const books: IBook[] = [];
                const bookPromises = result.rows.map(async (row) => {
                    return await createIBook(row, res);
                });
                books.push(...(await Promise.all(bookPromises)));
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
});

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
 * @apiError (400 Invalid page or offset) {string} message "The page number or offset in the request is not numberic."
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
 * @apiSuccess {IBook[]} books A list of books with title that are similar to the title to search for.
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
 * @apiSuccess {IBook[]} books A list of books with given ISBN.
 *
 * @apiError (400 Invalid ISBN) {string} message "The ISBN in the request is not numberic."
 * @apiError (400 Invalid ISBN) {string} message "The ISBN in the request is not 13 digits long."
 */

export { bookRouter };
