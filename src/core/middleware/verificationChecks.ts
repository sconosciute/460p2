import { NextFunction, RequestHandler, Response } from 'express';
import { IJwtRequest } from '../models/JwtRequest.model';
import { pool } from '../utilities';

export const checkParamsIdToJwtId = (
    request: IJwtRequest,
    response: Response,
    next: NextFunction
) => {
    if (request.params.id !== request.claims.id) {
        response.status(400).send({
            message: 'Credentials do not match for this user.',
        });
    }
    next();
};
//Add middle ware for permissions
export const hasPermissions = (permissions) => (req, res, next) => {
    // Query to retrieve permissions for the current user

};
