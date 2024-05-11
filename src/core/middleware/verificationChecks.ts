import { NextFunction, RequestHandler, Response } from 'express';
import { IJwtRequest } from '../models/JwtRequest.model';

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
export const hasPermissions = (permissions) => {
    return (request, response, next) => {

        //Not sure if this is the correct call for retrieving from the database?
        const userRole = request.user.role;

        if (permissions.includes(userRole)) {
            next();
        } else {
            response.status(401).send({
                message: 'Missing required permission to access',
            });
        }
    };
};





