import * as fs from 'fs';

let appConfig: any;

export function getAppConfig(): any {
    if (!appConfig) {
        let raw = fs.readFileSync('./resources/app_config.json').toString();
        appConfig = JSON.parse(raw);
    }
    return appConfig;
}