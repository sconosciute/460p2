import express, { Router } from 'express';

import { signinRouter } from './login';
import { registerRouter } from './register';
import { authHelpRouter } from './helpers';
import jwt from 'jsonwebtoken';

const key = {
    secret: process.env.JSON_WEB_TOKEN,
};

const authRoutes: Router = express.Router();

authRoutes.use(signinRouter, registerRouter, authHelpRouter);

export function issueJwt(id: number): string {
    return jwt.sign({}, key.secret, {
        expiresIn: '14 days',
        subject: id.toString(),
        audience: process.env.DOMAIN,
    });
}

export { authRoutes };
