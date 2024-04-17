import express, { Request, Response, Router } from 'express';

const helloRouter = express.Router();

helloRouter.get('/', (req: Request, res: Response) => {
    res.send({
        message: 'Hello!',
    });
});

export { helloRouter };