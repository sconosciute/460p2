// Express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool, validationFunctions } from '../../core/utilities';
// import { roleCheck } from './index';
import { IJwtRequest } from '../../core/models';

const mrRouter: Router = express.Router();

// Middleware to check if the user is an admin.
const roleCheck = (permission: string) => {
    return async (req: IJwtRequest, res: Response, next: NextFunction) => {
        const query = 'SELECT roles.admin, roles.update_add, roles.delete, roles.manage_users FROM roles INNER JOIN account a on roles.id = a.role_id WHERE account_id = $1';
        const values = [req.claims.sub];
        const perm = permission.toLowerCase();

        const ans = await pool.query(query, values);

        if (ans.rows[0][perm]) {
            next();
        } else {
            res.status(403).send({
                message: 'User not authorized to perform this action.',
            });
        }
    };
};

const checkManagePerm = roleCheck('manage_users');

/**
 * @api {post} /changeUserRole
 *
 * @apiDescription Allows an admin user to update a user's role in the database.
 *
 * @apiName ChangeUserRole
 * @apiGroup manageroles
 *
 * @apiBody {Integer} userID The ID of the user that will have their role changed.
 * @apiBody {Integer} newRoleID The ID of the user's new role.
 *
 * @apiSuccess (200: Success) {String} message 'User role changed successfully.'
 *
 * @apiError (401: Invalid token) {String} message 'User not authorized to perform this action.'
 * @apiError (500: Internal server error) {String} message 'Server error during database query.'
 */
mrRouter.put('/updateRole', checkManagePerm, (req, res) => {
    const userID = req.body.userID;
    const newRoleID = req.body.newRoleID;
    const query = `UPDATE account
                   SET role_id = $1
                   WHERE account_id = $2;`;

    pool.query(query, [newRoleID, userID])
        .then(() => {
            res.status(200).send(
                { message: 'User role changed successfully.' },
            );
        })
        .catch(error => {
            console.error(`Failed to update user role due to ${error}`);
            res.status(500).send(
                { message: 'Server error during database query.' },
            );
        });
});

/**
 * @api {put} /newRole
 *
 * @apiDescription Allows an admin user to add a new role to the database.
 *
 * @apiName AddNewRole
 * @apiGroup manageroles
 *
 * @apiBody {String} roleName The name of the new role.
 * @apiBody {Boolean} admin True if the new role has admin privileges.
 * @apiBody {Boolean} updateAdd True if the new role can update and add books.
 * @apiBody {Boolean} canDelete True if the new role can delete books.
 * @apiBody {Boolean} manageUsers True if the new role can manage users.
 *
 * @apiSuccess (200: Success) {String} message 'Added new role successfully.'
 * @apiSuccess (200: Success) {IRole} role the roles object including id, name, admin, update_add, delete, manage_users
 *
 * @apiError (401: Invalid token) {String} message 'User not authorized to perform this action.'
 * @apiError (500: Internal server error) {String} message 'Server error during database query.'
 */
mrRouter.post('/newRole', roleCheck('admin'), (req, res) => {
    const roleName = req.body.roleName;
    const admin = req.body.admin;
    const updateAdd = req.body.updateAdd;
    const canDelete = req.body.canDelete;
    const manageUsers = req.body.manageUsers;
    const query = `INSERT INTO roles (role_name, admin, update_add, delete, manage_users)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id, role_name, admin, update_add, delete, manage_users;`;

    // Execute the database query
    pool.query(query, [roleName, admin, updateAdd, canDelete, manageUsers])
        .then((result) => {
            res.status(200).send(
                {
                    message: 'Added new role successfully.',
                    role: result.rows[0],
                },
            );
        })
        .catch(error => {
            console.error(`Failed to add role due to ${error}`);
            res.status(500).send(
                { message: 'Server error during database query.' },
            );
        });
});

export { mrRouter };