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

/*
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

/*
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

/*
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

export {bookRouter}