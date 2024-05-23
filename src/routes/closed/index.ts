import express, { Router } from 'express';

import { tokenTestRouter } from './tokenTest';
import { bookRouter } from './books';
import { mrRouter } from './manageroles';

const closedRoutes: Router = express.Router();

closedRoutes.use('/jwt_test', tokenTestRouter);
closedRoutes.use('/books', bookRouter);
closedRoutes.use('/users', mrRouter);

export { closedRoutes };
