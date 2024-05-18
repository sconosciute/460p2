// Express is the framework we're going to use to handle requests
import express, { NextFunction, Request, Response, Router } from 'express';
// Access the connection to Postgres Database
import { pool } from '../../core/utilities';
// import { roleCheck } from './index';
import { IJwtRequest } from '../../core/models';

const mrRouter: Router = express.Router();

// Middleware to check if the user is an admin.
const roleCheck = (permission: string) => {
    return async (req: IJwtRequest, res: Response, next: NextFunction) => {
        const query =
            'SELECT roles.admin, roles.update_add, roles.delete, roles.manage_users FROM roles INNER JOIN account a on roles.id = a.role_id WHERE account_id = $1';
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

// Middleware to check if the ChangeUserRole input is valid.
const checkCURparams = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    const userID = parseInt(request.body.userID);
    const newRoleID = parseInt(request.body.newRoleID);

    if (!isNaN(userID) && userID >= 1 && !isNaN(newRoleID) && newRoleID >= 1) {
        next();
    } else {
        response.status(400).json({ error: 'Invalid or missing ID.' });
    }
};

// Middleware for validating AddNewRole input is valid.
const checkANRparams = (
    request: Request,
    response: Response,
    next: NextFunction
) => {
    const roleName = request.body.roleName;
    const admin = request.body.admin;
    const updateAdd = request.body.updateAdd;
    const canDelete = request.body.canDelete;
    const manageUsers = request.body.manageUsers;

    if (typeof roleName !== 'string' || roleName.trim() === '') {
        return response.status(400).json({
            message: 'roleName value must be a non-empty string.',
        });
    }

    if (typeof admin !== 'boolean') {
        return response.status(400).json({
            message: 'admin value must be a boolean.',
        });
    }

    if (typeof updateAdd !== 'boolean') {
        return response.status(400).json({
            message: 'updateAdd must be a boolean.',
        });
    }

    if (typeof canDelete !== 'boolean') {
        return response.status(400).json({
            message: 'canDelete must be a boolean.',
        });
    }

    if (typeof manageUsers !== 'boolean') {
        return response.status(400).json({
            message: 'manageUsers must be a boolean.',
        });
    }

    next();
};

/**
 * @api {post} /users/changeUserRole
 * Change a role in the database
 *
 * @apiDescription Allows an admin user to update a user's role in the database.
 *
 * @apiName ChangeUserRole
 * @apiGroup ManageRoles
 *
 * @apiBody {Integer} userID The ID of the user that will have their role changed.
 * @apiBody {Integer} newRoleID The ID of the user's new role.
 *
 * @apiSuccess (200: Success) {String} message 'User role changed successfully.'
 *
 * @apiError (400: Bad request) {String} message 'Invalid or missing ID.'
 * @apiError (401: Invalid token) {String} message 'User not authorized to perform this action.'
 * @apiError (500: Internal server error) {String} message 'Server error during database query.'
 */
mrRouter.put('/updateRole', checkManagePerm, checkCURparams, (req, res) => {
    const userID = req.body.userID;
    const newRoleID = req.body.newRoleID;
    const query = `UPDATE account
                   SET role_id = $1
                   WHERE account_id = $2;`;

    pool.query(query, [newRoleID, userID])
        .then(() => {
            res.status(200).send({
                message: 'User role changed successfully.',
            });
        })
        .catch((error) => {
            console.error(`Failed to update user role due to ${error}`);
            res.status(500).send({
                message: 'Server error during database query.',
            });
        });
});

/**
 * @api {put} /users/newRole
 * Add a new role to the database
 *
 * @apiDescription Allows an admin user to add a new role to the database.
 *
 * @apiName AddNewRole
 * @apiGroup ManageRoles
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
 * @apiError (400: Bad request) {String} message 'roleName value must be a non-empty string.'
 * @apiError (400: Bad request) {String} message 'admin value must be a boolean.'
 * @apiError (400: Bad request) {String} message 'updateAdd value must be a boolean.'
 * @apiError (400: Bad request) {String} message 'canDelete value must be a boolean.'
 * @apiError (400: Bad request) {String} message 'manageUsers value must be a boolean.'
 * @apiError (401: Invalid token) {String} message 'User not authorized to perform this action.'
 * @apiError (500: Internal server error) {String} message 'Server error during database query.'
 */
mrRouter.post('/newRole', roleCheck('admin'), checkANRparams, (req, res) => {
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
            res.status(200).send({
                message: 'Added new role successfully.',
                role: result.rows[0],
            });
        })
        .catch((error) => {
            console.error(`Failed to add role due to ${error}`);
            res.status(500).send({
                message: 'Server error during database query.',
            });
        });
});

export { mrRouter };
