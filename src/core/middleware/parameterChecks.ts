import { NextFunction, Request, Response } from 'express';
import { pool, validationFunctions } from '../../core/utilities';

const isNumberProvided = validationFunctions.isNumberProvided;

/**
 * Check whether the query parameter 'orderby' is valid. If orderby is empty or not one of these values
 * ['title', 'author', 'year'] change it to default value 'title'.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next function.
 */
const validOrderby = (req: Request, res: Response, next: NextFunction) => {
    let orderby = req.query.orderby ?? 'title';
    if (orderby != 'title' && orderby != 'author' && orderby != 'year')
        orderby = 'title';
    req.query.orderby = orderby;
    next();
};

/**
 * Check whether the query parameter 'sort' is valid. If sort is empty or is neither 'asc' nor 'desc',
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
        const theQuery = `SELECT COUNT(id) AS count
                          FROM books`;
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
 * @param next The next middleware function to run.
 */
const validISBN = (req: Request, res: Response, next: NextFunction) => {
    console.log('ISBN Check');
    if (!req.query.isbn) {
        next();
    } else {
        if (!isNumberProvided(req.query.isbn)) {
            console.error('The ISBN is not numeric.');
            res.status(400).send({
                message: 'Can not parse ISBN.',
            });
        } else if (req.query.isbn.length != 13) {
            console.error('The ISBN is not 13 digits.');
            res.status(400).send({
                message: 'ISBN must be 13 characters.',
            });
        } else {
            next();
        }
    }
};

/**
 * Checker whether the title is valid. If title is blank, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next middleware function to run.
 */
const validTitle = (req: Request, res: Response, next: NextFunction) => {
    console.log('Title Check');
    if (
        !req.query.title ||
        validationFunctions.isStringProvided(req.query.title)
    ) {
        next();
    } else {
        res.status(400).send({
            message: 'Could not parse title.',
        });
    }
};

/**
 * Checker whether the author is valid. If title is blank, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next middleware function to run.
 */
const validAuthor = (req: Request, res: Response, next: NextFunction) => {
    console.log('author check');
    if (
        !req.query.author ||
        validationFunctions.isStringProvided(req.query.author)
    ) {
        next();
    } else {
        res.status(400).send({
            message: 'Could not parse author name.',
        });
    }
};

/**
 * Checks if min and max or provided and well-formed. Min must be greater than 0, Max must be less than 6, min must be less than or equal to max.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 * @param next The next middleware function to run.
 */
const validMinMax = (req: Request, res: Response, next: NextFunction) => {
    console.log('min/max check');
    if (req.query.min || req.query.max) {
        req.query.min = isNumberProvided(req.query.min) ? req.query.min : '1';
        req.query.max = isNumberProvided(req.query.max) ? req.query.max : '5';
    } else {
        next();
    }
    if (
        req.query.min ||
        req.query.max ||
        (isNumberProvided(req.query.min) && isNumberProvided(req.query.max))
    ) {
        req.query.min = clamp(Number(req.query.min), 5, 1).toString();
        req.query.max = clamp(Number(req.query.max), 5, 1).toString();
        if (Number(req.query?.min) > Number(req.query?.max)) {
            res.status(400).send({
                message: `Minimum rating ${req.query.min} must be less than or equal to maximum rating ${req.query.max}.`,
            });
        } else {
            console.dir(req.query);
            next();
        }
    }
};

/**
 * Clamp a given number between the provided min and max values.
 * @param n the number to clamp
 * @param max the inclusive maximum value
 * @param min the inclusive minimum value.
 */
function clamp(n: number, max: number, min: number): number {
    return n <= min ? min : n >= max ? max : n;
}


/**
 * Check if the ratingtype is valid for ratings. If it is invalid, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 */
const validRatingType = (req: Request, res: Response, next: NextFunction) => {
    console.log('Rating type check');
    const validRatingType = ['rating_1_star', 'rating_2_star', 'rating_3_star', 'rating_4_star', 'rating_5_star'];

    if (req.query.ratingtype && String(req.query.ratingtype).trim().length == 0
        || !validRatingType.includes(String(req.query.ratingtype))){
        return res.status(400).send({
            message: 'Invalid rating type.',
        });
    }
    next();
};

/**
 * Check if the changetype is valid for ratings. If it is invalid, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 */
const validRatingChangeType = (req: Request, res: Response, next: NextFunction) => {
    console.log('Rating change type check');
    const validRatingChangeType = ['decreaseby', 'increaseby', 'setto'];

    if (req.query.changetype && String(req.query.changetype).trim().length == 0
        || !validRatingChangeType.includes(String(req.query.changetype))){
        return res.status(400).send({
            message: 'Invalid rating change type.',
        });
    }
    next();
};

/**
 * Check if the value for rating is valid for ratings. If it is invalid, send 400 in response.
 *
 * @param req The HTTP request.
 * @param res The HTTP response.
 */
const validRatingValue = (req: Request, res: Response, next: NextFunction) => {
    console.log('Rating value check');
    if (req.query.value && isNaN(Number(req.query.value))){
        return res.status(400).send({
            message: 'Invalid value to set or change rating by.',
        });
    }
    next();
};

const parameterChecks = {
    validOrderby,
    validSort,
    validOffset,
    validPage,
    validISBN,
    validTitle,
    validAuthor,
    validMinMax,
    validRatingType,
    validRatingChangeType,
    validRatingValue
};

export { parameterChecks };
