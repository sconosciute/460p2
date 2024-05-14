import { NextFunction, Request, Response } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const isNumberProvided = validationFunctions.isNumberProvided;

/**
 * Check whetehr the query parameter 'sort' is valid. If sort is empty or is neither 'asc' nor 'desc',
 * change it to default value 'asc'.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next function.
 */
const validSort = (req: Request, res: Response, next: NextFunction) => {
    let sort = req.query.sort ?? 'asc';
    if (sort != 'asc' && sort != 'desc') sort = 'asc';
    req.query.sort = sort;
    next();
};

/**
 * Checker whether the offset is valid. If offset is empty or zero, set the offset to default value 15.
 * Otherwise, use absolute value of offset in the request. If the offset is not numeric, send 400 in
 * response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next function.
 */
const validOffset = (req: Request, res: Response, next: NextFunction) => {
    let offset = req.query.offset ?? 15; // Get parameter or set to default value 15
    if (isNumberProvided(offset)) {
        offset = Math.abs(Number(offset));
        if (offset == 0) offset = 15;
        req.query.offset = offset.toString();
        next();
    } else {
        console.error('The offset is not numeric.');
        res.status(400).send({
            message:
                'The offset you passed through the request is not numberic.',
        });
    }
};

/**
 * Checker whether the page number is valid. If page is empty or negative, set the offset to
 * default value 1. If the page is greater than the maximum nubmer of page, set that to the maximum
 * number. If the page is not numeric, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next function.
 */
const validPage = (req: Request, res: Response, next: NextFunction) => {
    const temp = req.query.page ?? 1; // Get parameter or set to default value 1
    let page: number;
    if (isNumberProvided(temp)) {
        const offset = Math.abs(Number(req.query.offset));
        page = Number(temp);
        const theQuery = `SELECT COUNT(id) AS count FROM books`;
        pool.query(theQuery)
            .then((result) => {
                const maxPage: number = Math.ceil(
                    result.rows[0].count / offset
                );
                if (page > maxPage) page = maxPage;
                else if (page < 1) page = 1;
                req.query.page = page.toString();
                next();
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
    } else {
        console.error('The page number is not numberic.');
        res.status(400).send({
            message:
                'The page number you passed through the request is not numberic.',
        });
    }
};

/**
 * Checker whether the ISBN is valid. If ISBN is not numeric or is not 13 digits, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 */
const validISBN = (req: Request, res: Response) => {
    if (req.query.isbn && String(req.query.isbn).trim().length == 0) {
        console.error('ISBN cannot be blank.');
        res.status(400).send({
            message: 'ISBN cannot be blank.',
        });
    } else if (!isNumberProvided(req.query.isbn)) {
        console.error('The ISBN is not numberic.');
        res.status(400).send({
            message: 'The ISBN you passed through the request is not numberic.',
        });
    } else if (req.query.isbn.length != 13) {
        console.error('The ISBN is not 13 digits.');
        res.status(400).send({
            message:
                'The ISBN you passed through the request is not 13 digits.',
        });
    }
};

/**
 * Checker whether the title is valid. If title is blank, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 */
const validTitle = (req: Request, res: Response) => {
    if (req.query.title && String(req.query.title).trim().length == 0) {
        console.error('Title cannot be blank.');
        res.status(400).send({
            message: 'Title cannot be blank.',
        });
    }
};

const parameterChecks = {
    validSort,
    validOffset,
    validPage,
    validISBN,
    validTitle,
};

export { parameterChecks };
