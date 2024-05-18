import express, { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../../core/utilities';

export const authHelpRouter = express.Router();

/**
 * @api {GET} /roles
 * Get all avaliable roles in the database.
 *
 * @apiDescription Retrieves an array of user roles currently available in the database.
 *
 * @apiName GetRolesList
 * @apiGroup Auth
 *
 * @apiSuccess (201: Success) {any[]} roles An array of valid roles currently stored in the database.
 * @apiSuccessExample roles-format:
 *      {
 *          roles: [
 *              id: 0,
 *              role_name: "User"
 *          ]
 *      }
 *
 * @apiError (500: Server error) If roles could not be retrieved from the database.
 */
authHelpRouter.get(
    '/roles',
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ans = await pool.query('SELECT id, role_name FROM roles');
            res.send({ roles: ans.rows });
        } catch (e) {
            console.log(`DB Query error on GET, couldn't retrieve roles`);
            res.status(500).send(
                'Server Error\nCode: MARSHPOTAO\nContact support.'
            );
        }
    }
);
