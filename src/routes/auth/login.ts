// express is the framework we're going to use to handle requests
import express, { Request, Response, Router, NextFunction } from 'express';

import jwt from 'jsonwebtoken';

import {
    pool,
    validationFunctions,
    credentialingFunctions,
} from '../../core/utilities';
import { issueJwt } from './index';

export interface Auth {
    email: string;
    password: string;
}

export interface AuthRequest extends Request {
    auth: Auth;
}

const isStringProvided = validationFunctions.isStringProvided;
const generateHash = credentialingFunctions.generateHash;

const signinRouter: Router = express.Router();

const key = {
    secret: process.env.JSON_WEB_TOKEN,
};

/**
 * @api {post} /login Request to sign a user in the system
 * @apiName GetAuth
 * @apiGroup Auth
 *
 * @apiHeader {string} authorization "Basic email:password" where email:password is a Base64 encoded string.
 *
 * @apiSuccess {String} accessToken JSON Web Token
 * @apiSuccess {number} id unique user id

 * @apiError (400: Missing Authorization Header) {String} message "Missing Authorization Header"
 * @apiError (400: Malformed Authorization Header) {String} message "Malformed Authorization Header"
 * @apiError (404: User Not Found) {String} message "User not found"
 * @apiError (401: Invalid Credentials) {String} message "Incorrect Username/Password"
 *
 */
signinRouter.post(
    '/login',
    (request: AuthRequest, response: Response, next: NextFunction) => {
        if (
            isStringProvided(request.headers.authorization)
        ) {
            next();
        } else {
            response.status(400).send({
                message: 'Missing authorization header',
            });
        }
    },
    (request: AuthRequest, response: Response) => {
        const theQuery = `SELECT salted_hash,
                                 salt,
                                 account_Credential.account_id,
                                 account.email,
                                 account.firstname,
                                 account.lastname,
                                 account.phone,
                                 account.username,
                                 account.role_id,
                                 account.create_date
                          FROM account_credential
                                   INNER JOIN account ON
                              account_Credential.account_id = account.account_id
                          WHERE account.email = $1`;
        console.log(request.headers.authorization);
        const auth = atob((request.headers.authorization).replace('Basic ', ''));
        console.log(auth);
        const [email, pass] = auth.split(':');
        console.log(`email: ${email}, PW: ${pass}`);

        const values = [email];
        pool.query(theQuery, values)
            .then((result) => {
                if (result.rowCount == 0) {
                    response.status(404).send({
                        message: 'User not found',
                    });
                    return;
                } else if (result.rowCount > 1) {
                    //log the error
                    console.error(
                        'Multiple users exist with same email!',
                    );
                    response.status(500).send({
                        message: 'server error - contact support',
                    });
                    return;
                }

                //Retrieve the salt used to create the salted-hash provided from the DB
                const salt = result.rows[0].salt;

                //Retrieve the salted-hash password provided from the DB
                const storedSaltedHash = result.rows[0].salted_hash;

                //Generate a hash based on the stored salt and the provided password
                const providedSaltedHash = generateHash(
                    pass,
                    salt,
                );

                //Did our salted hash match their salted hash?
                if (storedSaltedHash === providedSaltedHash) {
                    //credentials match. get a new JWT
                    const accessToken = issueJwt(result.rows[0].account_id);
                    //package and send the results
                    response.json({
                        accessToken,
                        id: result.rows[0].account_id,
                    });
                } else {
                    //credentials dod not match
                    response.setHeader('WWW-Authenticate', 'Basic realm=User Login');
                    response.status(401).send({
                        message: 'Incorrect Username/Password',
                    });
                }
            })
            .catch((error) => {
                //log the error
                console.error('DB Query error on sign in');
                console.error(error);
                response.status(500).send({
                    message: 'server error - contact support',
                });
            });
    },
);

export { signinRouter };
