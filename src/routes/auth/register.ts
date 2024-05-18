// express is the framework we're going to use to handle requests
import express, { Request, Response, Router, NextFunction } from 'express';

import jwt from 'jsonwebtoken';

const key = {
    secret: process.env.JSON_WEB_TOKEN,
};

import {
    pool,
    validationFunctions,
    credentialingFunctions,
} from '../../core/utilities';
import { QueryResult } from 'pg';
import { issueJwt } from './index';

const isStringProvided = validationFunctions.isStringProvided;
const isNumberProvided = validationFunctions.isNumberProvided;
const generateHash = credentialingFunctions.generateHash;
const generateSalt = credentialingFunctions.generateSalt;

const registerRouter: Router = express.Router();

export interface IUserRequest extends Request {
    id: number;
}

// Add more/your own password validation here. The *rules* must be documented
// and the client-side validation should match these rules.
const isValidPassword = (password: string): boolean =>
    isStringProvided(password) && password.length > 7;

// Add more/your own phone number validation here. The *rules* must be documented
// and the client-side validation should match these rules.
const isValidPhone = (phone: string): boolean =>
    isStringProvided(phone) && phone.length >= 10;

/**
 * Checks to ensure that a given role exists in the database
 * @param role The role to check for.
 */
const isValidRole = async (role: string): Promise<boolean> => {
    if (!isNumberProvided(role)) return false;
    const q = {
        text: 'SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1)',
        values: [role],
        rowMode: 'array',
    };
    return await pool.query(q).then((result) => result.rows[0][0]);
};

// Add more/your own email validation here. The *rules* must be documented
// and the client-side validation should match these rules.
const isValidEmail = (email: string): boolean =>
    isStringProvided(email) && email.includes('@');

/**
 * Checks if email is valid
 */
const mwCheckEmail = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    console.dir(request.body);
    if (isValidEmail(request.body.email)) {
        next();
    } else {
        response.status(400).send({
            message:
                'Invalid or missing email  - please refer to documentation',
        });
    }
};

const mwCheckProvidedReqParam = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    //Verify that the caller supplied all the parameters
    //In js, empty strings or null values evaluate to false
    if (
        isStringProvided(request.body.firstname) &&
        isStringProvided(request.body.lastname) &&
        isStringProvided(request.body.username)
    ) {
        next();
    } else {
        response.status(400).send({
            message: 'Missing required information',
        });
    }
};

const mwCheckPhone = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if (isValidPhone(request.body.phone)) {
        next();
        return;
    } else {
        response.status(400).send({
            message:
                'Invalid or missing phone number  - please refer to documentation',
        });
        return;
    }
};

const mwCheckPassword = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if (isValidPassword(request.body.password)) {
        next();
    } else {
        response.status(400).send({
            message:
                'Invalid or missing password  - please refer to documentation',
        });
    }
};

const mwCheckRole = async (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    if (await isValidRole(request.body.role)) {
        next();
    } else {
        response.status(400).send({
            message: 'Invalid or missing role  - please refer to documentation',
        });
    }
};

const mwRegisterUser = async (
    req: IUserRequest,
    res: Response,
    next: NextFunction
) => {
    console.log(`Registering new user, ${req.body.username}.`);
    const qAcc = ` INSERT INTO Account(firstname, lastname, username, email, phone, role_id, create_date)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING account_id`;
    const vAcc = [
        req.body.firstname,
        req.body.lastname,
        req.body.username,
        req.body.email,
        req.body.phone,
        req.body.role,
    ];

    const salt = generateSalt(32);
    const saltedHash = generateHash(req.body.password, salt);
    const qCred = `INSERT INTO Account_Credential(account_id, salted_hash, salt)
         VALUES ($1, $2, $3)`;

    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const ans = await db.query(qAcc, vAcc);
        const accId = ans.rows[0].account_id;
        const vCred = [accId, saltedHash, salt];
        await db.query(qCred, vCred);
        await db.query('COMMIT');
        db.release();

        const accessToken = issueJwt(accId);

        console.log('Registered new user, sending success!');
        res.status(201).send({
            accessToken,
            id: req.id,
        });
    } catch (error) {
        console.error('Failed to register, rolling back.');
        await db.query('ROLLBACK');
        db.release();
        if (error.constraint == 'account_username_key') {
            res.status(409).send({
                message: 'Username already exists',
            });
        } else if (error.constraint == 'account_email_key') {
            res.status(409).send({
                message: 'Email already registered',
            });
        } else {
            console.error('DB Query error on register');
            console.error(error);
            res.status(500).send({
                message: 'server error - contact support',
            });
        }
    }
};

/**
 * @api {post} /register Request to register a user
 *
 * @apiDescription Document this route. !**Document the password rules here**!
 * !**Document the role rules here**!
 *
 * @apiName PostAuth
 * @apiGroup Auth
 *
 * @apiBody {String} firstname a users first name
 * @apiBody {String} lastname a users last name
 * @apiBody {String} email a users email *unique
 * @apiBody {String} password a users password
 * @apiBody {String} username a username *unique
 * @apiBody {String} role a role for this user [1-5]
 * @apiBody {String} phone a phone number for this user
 *
 * @apiSuccess (201 Success) {string} accessToken a newly created JWT
 * @apiSuccess (201 Success) {number} id unique user id
 * @apiSuccessExample token-id:
 *      {
 *          accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
 *          id: 123456789
 *      }
 *
 * @apiError (400: Missing Parameters) {String} message "Missing required information"
 * @apiError (400: Invalid Password) {String} message "Invalid or missing password  - please refer to documentation"
 * @apiError (400: Invalid Phone) {String} message "Invalid or missing phone number  - please refer to documentation"
 * @apiError (400: Invalid Email) {String} message "Invalid or missing email  - please refer to documentation"
 * @apiError (400: Invalid Role) {String} message "Invalid or missing role  - please refer to documentation"
 * @apiError (400: Username exists) {String} message "Username exists"
 * @apiError (400: Email exists) {String} message "Email exists"
 *
 */
registerRouter.post(
    '/register',
    mwCheckEmail, // these middleware functions may be defined elsewhere!
    mwCheckProvidedReqParam,
    mwCheckPhone,
    mwCheckPassword,
    mwCheckRole,
    mwRegisterUser
);

// registerRouter.get('/hash_demo', (request, response) => {
//     const password = 'password12345';

//     const salt = generateSalt(32);
//     const saltedHash = generateHash(password, salt);
//     const unsaltedHash = generateHash(password, '');

//     response.status(200).send({
//         salt: salt,
//         salted_hash: saltedHash,
//         unsalted_hash: unsaltedHash,
//     });
// });

export { registerRouter };
