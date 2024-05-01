//express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
//Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';

const bookRouter: Router = express.Router();

bookRouter.get('/all', (req: Request, res: Response, next: NextFunction) => {
    const query = 'SELECT title, authors, publication_year, isbn13 FROM books';

    pool.query(query)
        .then((result) => {
            res.send({
                entries: result.rows,
            });
        })
        .catch((e) => {
            console.log(`Server failed to retrieve books due to ${e}`);
            res.status(500).send('Server Error, so sorry!');
        });
});

export { bookRouter };
