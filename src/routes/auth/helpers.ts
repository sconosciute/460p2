import express, { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../../core/utilities';

export const authHelpRouter = express.Router();

/**
 * @api {GET} rolesList
 *
 * @apiDescription Retrieves an array of user roles currently available in the database.
 *
 * @apiName getRolesList
 * @apiGroup auth
 *
 * @apiBody {Array<{id<number>, role_name<String>}>} roles An array of valid roles currently stored in the database.
 *
 * @apiSuccess (201) {{id<number>, role_name<String>}[]} Roles available in database.
 *
 * @apiError (500: Server Error) If roles could not be retrieved from the database.
 *
 */
authHelpRouter.get('/roles',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ans = await pool.query("SELECT id, role_name FROM roles");
            res.send( {roles: ans.rows});
        } catch (e) {
            console.log(`DB Query error on GET, couldn't retrieve roles`);
            res.status(500).send("Server Error\nCode: MARSHPOTAO\nContact support.")
        }
    });