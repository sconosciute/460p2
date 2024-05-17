import express, { NextFunction, Router, Response } from 'express';

import { checkToken } from '../../core/middleware';
import { tokenTestRouter } from './tokenTest';
import { bookRouter } from './books';
import { IJwtRequest } from '../../core/models';
import { pool } from '../../core/utilities';

const closedRoutes: Router = express.Router();

closedRoutes.use('/jwt_test', checkToken, tokenTestRouter);
closedRoutes.use('/books', checkToken, bookRouter);

const roleCheck = (permission: string) => {
    return async (req: IJwtRequest, res: Response, next: NextFunction) => {
        const query = "SELECT roles.admin, roles.update_add, roles.delete, roles.manage_users FROM roles INNER JOIN account a on roles.id = a.role_id WHERE account_id = $1"
        const values = [req.claims.sub];
        const perm = permission.toLowerCase();

        const ans = await pool.query(query, values);

        if (ans.rows[0][perm]) {
            next();
        } else {
            res.status(403).send({
                message: "User not authorized to perform this action."
            })
        }
    }
}

export { closedRoutes };