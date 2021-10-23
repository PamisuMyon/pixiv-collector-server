import * as http from 'http';
import * as express from 'express';
import * as log4js from 'log4js';
import { logger, loggerror } from './common/logger';
import * as db from './dao/db';
import * as illustRouter from './router/illust_router';

(async () => {
    console.log('Connecting to database...');
    await db.connect();
    console.log('Connected to database.');

    const app = express();
    app.use(log4js.connectLogger(logger, { level: 'debug' }));
    app.use(log4js.connectLogger(loggerror, { level: 'error' }));
    app.use(express.json({ limit: '20mb' }))
    app.use(express.urlencoded({extended: true}));

    app.use('/api/v1/illust', illustRouter);

    http.createServer(app).listen('7007', function() {
    	console.log('Pixiv Collector Server listening on port 7007.')
    });
})();

