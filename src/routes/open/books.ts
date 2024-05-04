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
* @api {get} /allBooksByPubDate
*
* @apiDescription Request to retrieve all books, sorted by publication date.
*   If there are multiple books published on the same date, those books are then
*   sorted in descending alphabetical order (A to Z).
*
* @apiName getAllBooksByPubDate
* @apiGroup books
*
* @apiSuccess (200: Success) {Array<IBook>} Returns an array of all books with
*   the specified author, if any.
*
* @apiError (500: Internal server error) {String} Server or database error occurred.
*/
// method goes here

/*
* @api {get} /author
*
* @apiDescription Request to search and retrieve all books with the specified
*   author.
*
* @apiName getBooksByAuthor
* @apiGroup books
*
* @apiBody {String} authorName The author's first and/or last name.
*
* @apiSuccess (200: Success) {Array<IBook>} Returns an array of all books sorted
*   by publication date.
*
* @apiError (400: Bad request) {String} Missing parameter - Author name required.
* @apiError (500: Internal server error) {String} Server or database error occurred.
*/
// method goes here

/*
* @api {get} /rating
*
* @apiDescription Request to search and retrieve all books that have a rating
*   that is within the given rating range (inclusive).
*
* @apiName getBooksByRating
* @apiGroup books
*
* @apiBody {int} min The minimum rating.
* @apiBody {int} max The maximum rating.
*
* @apiSuccess (200: Success) {Array<IBook>} Returns an array of all books that
*   have a rating within the given range.
*
* @apiError (400: Bad request) {String} Missing parameter(s) - Min and Max rating
*   required.
* @apiError (500: Internal server error) {String} Server or database error occurred.
*/
// method goes here

export {bookRouter}