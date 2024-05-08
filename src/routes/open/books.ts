//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

bookRouter.get('/all',
    (req: Request, res: Response, next: NextFunction) => {
    const query = 'SELECT title, authors, publication_year, isbn13 FROM books';

    pool.query(query)
        .then((result) => {
            res.send({
                entries: result.rows
            })
        })
        .catch((e) => {
            console.log(`Server failed to retrieve books due to ${e}`)
            res.status(500).send("Server Error, so sorry!")
        })
    })
/*
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
bookRouter.get('/search',
        (req: Request, res: Response, next: NextFunction) => {
            console.log("Somebody tried to search!")
            res.status(501).send();
        });


/*
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
* @apiBody {number} rating_1 The amount of times book was rated 1
* @apiBody {number} rating_2 The amount of times book was rated 2
* @apiBody {number} rating_3 The amount of times book was rated 3
* @apiBody {number} rating_4 The amount of times book was rated 4
* @apiBody {number} rating_5 The amount of times book was rated 5
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


/*
* @api {delete} /books Request to delete a book
*
* @apiDescription Deletes a single book from the database by ID or the ISBN.
*
* @apiName DeleteBooks
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

/*
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






export {bookRouter}
