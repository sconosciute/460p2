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

export {bookRouter}