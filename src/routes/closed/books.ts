// Express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool } from '../../core/utilities';
import { parameterChecks } from '../../core/middleware';
import { IJwtRequest } from '../../core/models';

const bookRouter: Router = express.Router();

const validRatingType = parameterChecks.validRatingType;
const validRatingChangeType = parameterChecks.validRatingChangeType;
const validISBN = parameterChecks.validISBN;
const validRatingValue = parameterChecks.validRatingValue;

//region middleware
const roleCheck = (permission: string) => {
    return async (req: IJwtRequest, res: Response, next: NextFunction) => {
        const query =
            'SELECT roles.admin, roles.update_add, roles.delete, roles.manage_users FROM roles INNER JOIN account a on roles.id = a.role_id WHERE account_id = $1';
        const values = [req.claims.sub];
        const perm = permission.toLowerCase();

        const ans = await pool.query(query, values);

        if (ans.rows[0][perm] || ans.rows[0].admin) {
            next();
        } else {
            res.status(403).send({
                message: 'User not authorized to perform this action.',
            });
        }
    };
};

const checkUpdatePerm = roleCheck('update_add');
const checkDeletePerm = roleCheck('delete');
//endregion middleware

/**
 * @api {put} /books/update?isbn:=isbn&ratingtype:=ratingtype&changetype:=changetype&value:=value
 * Update the rating of a book
 *
 * @apiDescription Allows an authenticated user to update a book's rating.
 *   Retrieves the book to be updated with the ISBN. Updates the amount of
 *   1 star ratings, 2 star ratings... 5 star ratings that a book has (as
 *   specified by input) and automatically calculates then inserts the new
 *   average rating and total rating count into the database.
 *
 * @apiName UpdateBookRating
 * @apiGroup Books
 *
 * @apiQuery {Number} isbn The ISBN13 of the book to be updated.
 * @apiQuery {String="rating_1_star","rating_2_star","rating_3_star", "rating_4_star", "rating_5_star"} ratingtype="rating_1" Which rating to update.
 * @apiQuery {String="increaseby","decreaseby","setto"} changetype="increaseby" How to update the rating.
 * @apiQuery {Number} value The number to increase or decrease the rating by, or set the rating to this number.
 *
 * @apiSuccess (200: Success) {String} Book ratings updated successfully.
 *
 * @apiError (400: Bad request) {String} message Invalid rating type.
 * @apiError (400: Bad request) {String} message Invalid rating change type.
 * @apiError (400: Bad request) {String} message Invalid value to set or change rating by.
 * @apiError (400: Bad request) {String} message Update incomplete: No book with this ISBN.
 * @apiError (400: Bad request) {String} message Update incomplete: Rating amount cannot be a negative number.
 * @apiError (403: Unauthorized) {String} message Token is not valid.
 */
// Only works for book attributes for now
bookRouter.put(
    '/update',
    checkUpdatePerm,
    validISBN,
    validRatingType,
    validRatingChangeType,
    validRatingValue,
    (req: Request, res: Response) => {
        const isbn = req.query.isbn;
        const ratingtype = req.query.ratingtype;
        const changetype = req.query.changetype;
        const value = Number(req.query.value);

        // Build SQL query
        let query = `UPDATE books SET ${ratingtype} = `;

        if (changetype === 'increaseby') {
            query += `${ratingtype} + $1 `;
        } else if (changetype === 'decreaseby') {
            query += `${ratingtype} - $1 `;
        } else {
            // set
            query += `$1 `;
        }

        query += `WHERE isbn13 = $2;`;

        // Transaction
        pool.query('BEGIN')
            .then(() => {
                return pool.query(query, [value, isbn]);
            })
            .then((result) => {
                if (result.rowCount == 0) {
                    throw new Error('no books');
                }
            })
            .then(() => {
                const ratingCount = `SELECT ${ratingtype} FROM books WHERE isbn13 = $1;`;
                return pool.query(ratingCount, [isbn]);
            })
            .then((result) => {
                // Get attribute (rating_1_star, rating_2_star...)
                const attribute = Object.keys(result.rows[0]);

                // Ensure the rating results in a positive number
                result.rows.forEach((row) => {
                    attribute.forEach((ratingCount) => {
                        const updatedValue = row[ratingCount];
                        if (updatedValue < 0) {
                            throw new Error('negative number');
                        }
                    });
                });
            })
            .then((countPromise) => {
                // Update total rating count
                const calcCount = `UPDATE books SET rating_count = rating_1_star + rating_2_star + rating_3_star + rating_4_star + rating_5_star WHERE isbn13 = $1`;
                return pool.query(calcCount, [isbn]);
            })
            .then((avgPromise) => {
                // Update average rating
                const calcAvg = `UPDATE books SET rating_avg = ROUND((rating_1_star + 2*rating_2_star + 3*rating_3_star + 4*rating_4_star + 5*rating_5_star) / CAST(rating_count AS DECIMAL(30,1)), 2) WHERE isbn13 = $1`;
                return pool.query(calcAvg, [isbn]);
            })
            .then(() => {
                res.status(200).send({
                    message: 'Book ratings updated successfully.',
                });
                return;
            })
            .then(() => {
                return pool.query('COMMIT');
            })
            .catch((error) => {
                return pool.query('ROLLBACK').then(() => {
                    let errorMessage = 'Server or database error occurred.';
                    if (error.message === 'no books') {
                        errorMessage =
                            'Update incomplete: No book with this ISBN.';
                    } else if (error.message === 'negative number') {
                        errorMessage =
                            'Update incomplete: Rating amount cannot be a negative number.';
                    }

                    res.status(400).send({
                        message: errorMessage,
                    });
                });
            });
    }
);

/**
 * @api {post} /books/addBook
 * Request to add a new book
 *
 * @apiDescription This api allows an authenticated user with the correct permission to add a new book
 * in the database, with all the required information.
 *
 * @apiName PostAddBook
 * @apiGroup Books
 *
 * @apiBody {Number} id The added book's id
 * @apiBody {Number} isbn-13 An identifier of the book
 * @apiBody {String} authors The creator of the book can have more than one
 * @apiBody {Number} publication year A number that shows when the book was published
 * @apiBody {String} original_title Name the book was first given
 * @apiBody {String} title Another name for the book
 * @apiBody {Number} average rating The average amount of rate from 1-5
 * @apiBody {Number} ratings count total amount of time the book was rated
 * @apiBody {Number} rating_1 Number of 1-star rating on this book.
 * @apiBody {Number} rating_2 Number of 2-star rating on this book.
 * @apiBody {Number} rating_3 Number of 3-star rating on this book.
 * @apiBody {Number} rating_4 Number of 4-star rating on this book.
 * @apiBody {Number} rating_5 Number of 5-star rating on this book.
 * @apiBody {String} image_url The url of the image
 * @apiBody {String} small_image_url The url of the small image of the book
 *
 * @apiSuccess (201: Success) {String} Success new book was added to the database
 *
 * @apiError (400: Missing parameter) {String} message "Required information for new book is missing"
 * @apiError (403: Unauthorized user) {String} message "You do not have access to add book"
 * @apiError (401: Permission denied) {String} message "You do not have permission to add book"
 */

bookRouter.post('/addBook', checkUpdatePerm, async (req, res) => {
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
        image_small_url,
    } = req.body;

    // Check if ISBN-13 is valid
    if (
        !isbn13 ||
        typeof isbn13 !== 'string' ||
        isbn13.length !== 13 ||
        !/^\d{13}$/.test(isbn13)
    ) {
        return res
            .status(400)
            .send(
                'ISBN must be exactly 13 digits long and consist only of numbers'
            );
    }

    const requiredFields = [
        'id',
        'isbn13',
        'authors',
        'publication_year',
        'original_title',
        'title',
        'rating_avg',
        'rating_count',
        'rating_1_star',
        'rating_2_star',
        'rating_3_star',
        'rating_4_star',
        'rating_5_star',
        'image_url',
        'image_small_url',
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length > 0) {
        return res
            .status(400)
            .send('Required information for new book is missing');
    }

    const ratingFields = [
        'rating_avg',
        'rating_count',
        'rating_1_star',
        'rating_2_star',
        'rating_3_star',
        'rating_4_star',
        'rating_5_star',
    ];
    const invalidRatings = ratingFields.filter((field) =>
        isNaN(req.body[field])
    );
    if (invalidRatings.length > 0) {
        return res
            .status(400)
            .send('Rating fields must be numbers or decimals');
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check if the id already exists
        const idCheckResult = await client.query(
            'SELECT 1 FROM books WHERE id = $1',
            [id]
        );
        if (idCheckResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).send('ID already exists');
        }

        const bookInsertResult = await client.query(
            'INSERT INTO books (id, isbn13, publication_year, original_title, title, rating_avg, rating_count, rating_1_star, rating_2_star, rating_3_star, rating_4_star, rating_5_star, image_url, image_small_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *',
            [
                id,
                isbn13,
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
                image_small_url,
            ]
        );

        const bookId = bookInsertResult.rows[0].id;
        const authorNames = authors.split(';');
        const authorPromises = authorNames.map(async (authorName) => {
            const authorInsertResult = await client.query(
                'INSERT INTO authors (name) VALUES ($1) RETURNING id',
                [authorName]
            );
            const authorId = authorInsertResult.rows[0].id;
            await client.query(
                'INSERT INTO book_author (book, author) VALUES ($1, $2)',
                [bookId, authorId]
            );
        });

        await Promise.all(authorPromises);
        await client.query('COMMIT');
        res.status(201).send('Success, new book was added to the database');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to add book due to ${error}`);
        res.status(500).send('An error occurred while adding the book');
    } finally {
        client.release();
    }
});

/**
 * @api {delete} /books/deleteBook?isbn:=isbn
 * Request to delete a book
 *
 * @apiDescription Deletes a single book from the database the ISBN.
 *
 * @apiName DeleteBook
 * @apiGroup Books
 *
 * @apiQuery {Number} isbn The isbn of the book to delete
 *
 * @apiSuccess (200: Success) {String} Success book was deleted!
 *
 * @apiError (400: No book match) {String} message "No books found matching the criteria"
 * @apiError (401: Permission denied) {String} message "No permission to delete books"
 * @apiError (403: Unauthorized user) {String} message "Unauthorized user"
 */
bookRouter.delete(
    '/deleteIsbn',
    checkDeletePerm,
    parameterChecks.validISBN,
    (req: Request, res: Response, next: NextFunction) => {
        const isbn = req.query.isbn as string;

        pool.query(
            'DELETE FROM book_author WHERE book IN (SELECT id FROM books WHERE isbn13 = $1)',
            [isbn]
        )
            .then(() => {
                return pool.query('DELETE FROM books WHERE isbn13 = $1', [
                    isbn,
                ]);
            })
            .then(() => {
                res.status(200).send({
                    message: 'Success book was deleted!.',
                });
            });
        pool.query(
            'DELETE FROM book_author WHERE book IN (SELECT id FROM books WHERE isbn13 = $1)',
            [isbn]
        )
            .then(() => {
                return pool.query('DELETE FROM books WHERE isbn13 = $1', [
                    isbn,
                ]);
            })
            .then(() => {
                res.status(200).send({
                    message: 'Success book was deleted!.',
                });
            })
            .catch((error) => {
                console.error(
                    `Server failed to delete book(s) due to ${error}`
                );
                res.status(500).send('Server error, so sorry!');
            });
    }
);

/**
 * @api {delete} /books/deleteRangeBooks?min_id:=min_id&max_id:=max_id
 * Request to delete a range of books
 *
 * @apiDescription This deletes a range of books within a minimum book ID and maximum book ID
 * inclusively.
 *
 * @apiName DeleteRangeBooks
 * @apiGroup Books
 *
 * @apiQuery {Number} min_id The minimum ID of the range
 * @apiQuery {Number} max_id the maximum ID of the range
 *
 * @apiSuccess (200: Success) {String} Success Range of books deleted!
 *
 * @apiError (400: No book match) {String} message "No books found matching the criteria"
 * @apiError (401: Permission denied) {String} message "No permission to delete books"
 * @apiError (403: Unauthorized user) {String} message "Unauthorized user"
 */
bookRouter.delete(
    '/deleteRangeBooks',
    checkDeletePerm,
    (req: Request, res: Response, next: NextFunction) => {
        const { min_id, max_id } = req.query;

        if (
            !min_id ||
            !max_id ||
            isNaN(Number(min_id)) ||
            isNaN(Number(max_id))
        ) {
            return res.status(400).send({
                message: 'Please provide valid min_id and max_id parameters',
            });
        }

        const minId = parseInt(min_id as string, 10);
        const maxId = parseInt(max_id as string, 10);

        if (minId > maxId) {
            return res.status(400).send({
                message: 'Min range must be less than max range',
            });
        }

        const query =
            'DELETE FROM book_author WHERE book IN (SELECT id FROM books WHERE id >= $1 AND id <= $2);';
        pool.query(query, [minId, maxId])
            .then(() => {
                const deleteBooksQuery =
                    'DELETE FROM books WHERE id >= $1 AND id <= $2;';
                return pool.query(deleteBooksQuery, [minId, maxId]);
            })
            .then(() => {
                res.status(200).send({
                    message: 'Range of books deleted!',
                });
            });
    }
);

export { bookRouter };
