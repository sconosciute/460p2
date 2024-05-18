import express, { Router } from 'express';

import { bookRouter } from './books';

const openRoutes: Router = express.Router();
openRoutes.use('/books', bookRouter)

export { openRoutes };
