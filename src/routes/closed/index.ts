import express, { NextFunction, Router, Response } from 'express';

import { checkToken } from '../../core/middleware';
import { tokenTestRouter } from './tokenTest';
import { bookRouter } from './books';
import { IJwtRequest } from '../../core/models';
import { pool } from '../../core/utilities';

const closedRoutes: Router = express.Router();

closedRoutes.use('/jwt_test', checkToken, tokenTestRouter);
closedRoutes.use('/books', checkToken, bookRouter);

export { closedRoutes };