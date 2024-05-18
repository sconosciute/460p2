import express, { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../../core/utilities';

export const authHelpRouter = express.Router();

/**
 * @api {GET} /roles
 *
 * @apiDescription Retrieves an array of user roles currently available in the database.
 *
 * @apiName GetRolesList
 * @apiGroup Auth
 *
<<<<<<< HEAD
 * @apiSuccess (201: Success) {any[]} roles An array of valid roles currently stored in the database.
 * @apiSuccessExample roles-format:
 *      {
 *          roles: [
 *              id: 0,
 *              role_name: "User"
 *          ]
 *      }
=======
 * @apiBody {Array} roles An array of valid roles currently stored in the database.
 *
 * @apiSuccess (201) {Array} Roles available in database.
 *
 * @apiError (500: Server Error) If roles could not be retrieved from the database.
>>>>>>> 0830e36254b0c54e8332cff95252e4bc9a7828d0
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
