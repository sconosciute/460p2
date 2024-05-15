//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
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

        console.log('function hit');

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
                console.log(`Server failed to get books due to ${e}`);
                res.status(500).send('Error while performing database query.');
            });
    }
);


export { bookRouter };