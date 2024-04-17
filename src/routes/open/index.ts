import express, { Router } from 'express';

import { messageRouter } from './message';
import { helloRouter } from './helloWorld';

const openRoutes: Router = express.Router();

openRoutes.use('/message', messageRouter);
openRoutes.use('/hello', helloRouter);

export { openRoutes };
