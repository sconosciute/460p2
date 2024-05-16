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

        const query = 'SELECT roles.admin, roles.update_add, roles.delete, roles.manage_users FROM roles INNER JOIN account a on roles.id = a.role_idWHERE account_id = 2';

        if (permissions.includes(query)) {
            next();
        } else {
            response.status(401).send({
                message: 'Missing required permission to access',
            });
        }
    };
};





