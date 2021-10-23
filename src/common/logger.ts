import * as log4js from 'log4js';

let config: log4js.Configuration = {
    appenders: {
        console: { type: 'console' },
        normal: { type: 'dateFile', filename: 'logs/normal/normal.log'},
        error: { type: 'dateFile', filename: 'logs/error/error.log'}
    },
    categories: {
        default: { appenders: ['console', 'normal'], level: 'debug'},
        error: { appenders: ['console', 'error'], level: 'error'}
    }
};
log4js.configure(config);

export let logger = log4js.getLogger();
export let loggerror = log4js.getLogger('error');
