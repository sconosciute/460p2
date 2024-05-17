// Express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
import { parameterChecks } from '../../core/middleware';
import { IBook, IRatings, IUrlIcon } from '../../core/models';
import { QueryResult } from 'pg';

const bookRouter: Router = express.Router();

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
// Only works for book attributes for now
bookRouter.put(
    '/update',
    (req: Request, res: Response) => {
        const isbn = BigInt(req.query.isbn as string);
        const attribute = req.query.attribute;
        const newValue = req.query.newValue;

        // Check all params given
        if (!isbn || !attribute || !newValue) {
            return res.status(400).send({message: 'Missing parameter(s)'});
        }

        let table = 'books';
        if(attribute === 'authorsName') {
            table = 'authors';
        }

        const query = `UPDATE ${table} SET ${attribute} = $1 WHERE isbn13 = $2;`;

        // Currently does not work -- gives empty array of books.
        pool.query(query, [newValue, isbn])
            .then((result) => {
                res.status(200).send({
                    message: 'Book updated successfully.',
                });
            })
            .catch((e) => {
                console.log(`Server failed to update book due to ${e}`);
                res.status(500).send('Server or database error occurred.');
            });
    }
);

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
bookRouter.post('/addBook', (req, res) => {
    const {
        id,
        isbn13,
        authors,
        publication_year,
        original_title,
        title,
        rating_avg,
        rating_count,
        rating_1_star,
        rating_2_star,
        rating_3_star,
        rating_4_star,
        rating_5_star,
        image_url,
        image_small_url
    } = req.body;

    const requiredFields = ['id', 'isbn13', 'authors', 'publication_year', 'original_title', 'title', 'rating_avg', 'rating_count', 'rating_1_star', 'rating_2_star', 'rating_3_star', 'rating_4_star', 'rating_5_star', 'image_url', 'image_small_url'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
        return res.status(400).send("Required information for new book is missing ");
    }

    pool.query('BEGIN')
        .then(() => {
            return pool.query(
                'INSERT INTO books (id, isbn13, publication_year, original_title, title, rating_avg, rating_count, rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star, image_url, image_small_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
                [id, isbn13, publication_year, original_title, title, rating_avg, rating_count, rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star, image_url, image_small_url]
            );
        })
        .then(result => {
            const bookId = result.rows[0].id;
            const authorNames = authors.split(';');
            const authorPromises = authorNames.map(authorName => {
                return pool.query('INSERT INTO authors (name) VALUES ($1) RETURNING id', [authorName])
                    .then(authorResult => {
                        const authorId = authorResult.rows[0].id;
                        return pool.query('INSERT INTO book_author (book, author) VALUES ($1, $2)', [bookId, authorId]);
                    });
            });
            return Promise.all(authorPromises);
        })
        .then(() => pool.query('COMMIT'))
        .then(() => {
            res.status(201).send("Success new book was added to the database");
        })
        .catch(error => {
            return pool.query('ROLLBACK')
                .then(() => {
                    console.error(`Failed to add book due to ${error}`);
                    res.status(500).send("An error occurred while adding the book");
                });
        });
});

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
 * @apiError (400) {String} message "No books found matching the criteria"
 * @apiError (401) {String} message "No permission to delete books"
 * @apiError (403) {String} message "Unauthorized user"
 */
bookRouter.delete('/deleteBook/:isbn',(req: Request, res: Response, next: NextFunction) => {
    const isbn = req.params.isbn;

    if (!/^\d{13}$/.test(isbn)) {
        return res.status(400).send({
            message: 'No books found matching the criteria'
        });
    }
    pool.query('DELETE FROM book_author WHERE book IN (SELECT id FROM books WHERE isbn13 = $1)', [isbn])
        .then(() => {
            return pool.query('DELETE FROM books WHERE isbn13 = $1', [isbn]);
        })
        .then(() => {
            res.status(200).send({
                message: 'Success book was deleted!.'
            });
        })
        .catch((error) => {
            console.error(`Server failed to delete book(s) due to ${error}`);
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
 * @apiError (400) {String} message "No books found matching the criteria"
 * @apiError (401) {String} message "No permission to delete books"
 * @apiError (403) {String} message "Unauthorized user"
 */
bookRouter.delete('/deleteRangeBooks/:min_id/:max_id', (req: Request, res: Response, next: NextFunction) => {
    const { min_id, max_id } = req.params;

    if (isNaN(Number(min_id)) || isNaN(Number(max_id))) {
        return res.status(400).send({
            message: 'No books found matching the criteria'
        });
    }

    // Convert min_id and max_id to integers
    const minId = parseInt(min_id);
    const maxId = parseInt(max_id);

    // Validate that min_id is less than or equal to max_id
    if (minId > maxId) {
        return res.status(400).send({
            message: 'No books found matching the criteria'
        });
    }

    const query = 'DELETE FROM book_author WHERE book IN (SELECT id FROM books WHERE id >= $1 AND id <= $2);';
    pool.query(query, [min_id, max_id])
        .then(() => {
            const deleteBooksQuery = 'DELETE FROM books WHERE id >= $1 AND id <= $2;';
            return pool.query(deleteBooksQuery, [min_id, max_id]);
        })
        .then(() => {
            res.status(200).send({
                message: 'Range of books deleted!'
            });
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Server error, so sorry!');
        });
});


export { bookRouter };