import * as express from 'express';
import * as illustDao from '../dao/illust_dao';
import { getAppConfig } from '../common/config';
import { logger, loggerror } from '../common/logger';
import { illustsToDb } from '../common/data_processor';

const router = express.Router();

/* 根路径 /illust */

/**
 * GET 随机画作
 */
router.get('/', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    findRandom(req.query).then((r) => {
        let result = {
            code: 0,
            msg: null,
            count: r.illusts? r.illusts.length : 0,
            fallback: r.fallback,
            data: r
        }
        res.send(JSON.stringify(result));
    });
});

/**
 * POST 随机画作
 */
router.post('/', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    findRandom(req.body).then((r) => {
        let result = {
            code: 0,
            msg: null,
            count: r.illusts? r.illusts.length : 0,
            fallback: r.fallback,
            data: r.illusts
        }
        res.send(JSON.stringify(result));
    });
});

async function findRandom(p: any) {
    p = p || {};
    p.r18 = parseInt(p.r18);
    p.num = parseInt(p.num);
    p.maxSanityLevel = parseInt(p.maxSanityLevel);
    let option: illustDao.FindOptions = {
        num: p.num || 1,
        r18: (p.r18 != 1 && p.r18 != 2) ? 0 : p.r18,
        tags: p.tags || [],
        maxSanityLevel: p.maxSanityLevel || 0,
        matchMode: p.matchMode || illustDao.MatchMode.ACCURACY
    };

    if (!Array.isArray(option.tags)) {
        option.tags = [option.tags];
    }
    option.num = Math.min(30, Math.max(0, option.num));
    let r = await illustDao.random(option);
    let fallback = false;
    if ((!r || r.length == 0) && p.fallback) {
        r = await illustDao.random({ num: option.num, r18: 0})
        fallback = true;
    }
    let proxy = p.proxy || getAppConfig().defaultImageProxy;
    processUrl(r, proxy);
    return { illusts: r, fallback };
}

/**
 * 修改图片代理，拼接regular url
 */
function processUrl(items: any[], proxy) {
    if (!items) {
        return;
    }
    for (const item of items) {
        try {
            if (proxy) {
                for (const key in item.urls) {
                    if (item.urls[key]) {
                        item.urls[key] = item.urls[key].replace('i.pximg.net', proxy);
                    }
                }
            }
            // splice regular url
            if (item.urls.original) {
                let regular: string = item.urls.original;
                regular = regular.replace('img-original', 'img-master');
                let index = regular.lastIndexOf('.');
                regular = regular.slice(0, index) + '_master1200.jpg';
                item.urls.regular = regular;
            }
        } catch (err) {
            loggerror.error('Process illust url error');
            loggerror.error(err);
        }
    }
}

/**
 * 查询指定id的作品信息
 */
router.post('/info', function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');

    let body = req.body;
    body = body || {};
    body = {
        ids: body.ids || [],
        briefMode: body.briefMode,
        proxy: body.proxy || getAppConfig().defaultImageProxy
    }
    if (body.ids && Array.isArray(body.ids)) {
        for (let i = body.length; i >= 0; i--) {
            let id = parseInt(body.ids[i]);
            if (!isNaN(id)) {
                body.ids[i] = id;
            } else {
                body.ids.splice(i, 1);
            }
        }
        illustDao.findByIds(body.ids, body.briefMode).then((r) => {
            processUrl(r, body.proxy);
            let result = {
                code: 0,
                msg: null,
                data: r
            }
            res.send(JSON.stringify(result));
        });
    } else {
        let result = {
            code: -1,
            msg: `No data received.`
        }
        res.send(JSON.stringify(result));
    }
});

/* 管理相关 */
if (getAppConfig().enableIllustManage) {

    /**
     * PUT 从Pixiv raw data添加
     */
    router.put('/', function(req, res, next) {
        res.setHeader('Content-Type', 'application/json');

        let illusts = req.body;
        if (illusts && Array.isArray(illusts)) {
            let items = illustsToDb(illusts);
            illustDao.insertMany(items).then((r) => {
                let msg: string;
                if (r) {
                    msg = `${r.upsertedCount} item(s) upserted, ${r.modifiedCount} item(s) modified.`
                    logger.info(`PUT /illust ${msg}`);
                } else {
                    msg = 'DB operation failed.';
                    loggerror.error(`PUT /illust ${msg}`);
                }
                let result = {
                    code: 0,
                    msg
                }
                res.send(JSON.stringify(result));
            });
        } else {
            let result = {
                code: -1,
                msg: `No data received.`
            }
            res.send(JSON.stringify(result));
        }
    });

    /**
     * DELETE 移除
     */
    router.delete('/', function(req, res, next) {
        res.setHeader('Content-Type', 'application/json');

        let ids = req.body;
        if (ids && Array.isArray(ids)) {
            for (let i = ids.length - 1; i >= 0; i--) {
                let id = parseInt(ids[i]);
                if (!isNaN(id)) {
                    ids[i] = id;
                } else {
                    ids.splice(i, 1);
                }
            }
            illustDao.deleteMany(ids).then((r) => {
                let msg: string;
                if (r != -1) {
                    msg = `${r} item(s) deleted.`;
                    logger.info(`DELETE /illust ${msg}`);
                } else {
                    msg = 'DB operation failed.';
                    loggerror.error(`DELETE /illust ${msg}`);
                }
                let result = {
                    code: 0,
                    msg
                }
                res.send(JSON.stringify(result));
            });
        } else {
            let result = {
                code: -1,
                msg: `Invalid ids.`
            }
            res.send(JSON.stringify(result));
            return;
        }
    });

    /**
     * POST 查询列表
     */
    router.post('/list', function(req, res, next) {
        res.setHeader('Content-Type', 'application/json');

        let p = req.body;
        p = p || {};
        p.r18 = parseInt(p.r18);
        p.num = parseInt(p.num);
        p.maxSanityLevel = parseInt(p.maxSanityLevel);
        let option: illustDao.FindOptions = {
            num: p.num || 30,
            r18: (p.r18 != 1 && p.r18 != 2) ? 0 : p.r18,
            tags: p.tags || [],
            maxSanityLevel: p.maxSanityLevel || 0,
            offsetOid: p.offsetOid,
            sort: p.sort || 'desc',
        };
    
        if (!Array.isArray(option.tags)) {
            option.tags = [option.tags];
        }
        option.num = Math.max(0, option.num);
        illustDao.find(option).then((r) => {
            let proxy = p.proxy || getAppConfig().defaultImageProxy;
            processUrl(r, proxy);
            let result = {
                code: 0,
                msg: null,
                count: r? r.length : 0,
                data: r
            }
            res.send(JSON.stringify(result));
        });
    });

}

export = router;