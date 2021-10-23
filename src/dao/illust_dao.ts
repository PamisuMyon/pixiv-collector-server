import { ObjectId } from 'bson';
import { db } from './db';

export interface FindOptions {
    num: number;
    r18?: number;
    tags?: string[];
    matchMode?: string;
    maxSanityLevel?: number;
    offsetOid?: string;
    sort?: string;
}

function getFindFilter(options: FindOptions, accurate = false): any {
    let and = [];
    if (options.r18 == 0 || options.r18 == 1) {
        and.push({ r18: options.r18 });
    }
    if (options.tags && options.tags.length > 0) {
        if (accurate) {
            and.push({ tags: { $all: options.tags } });
        } else {
            for (const tag of options.tags) {
                and.push({ tags: { $regex: tag } })
            }
        }
    }
    if (options.maxSanityLevel > 1) {
        and.push({ sanity_level: { $lte: options.maxSanityLevel } });
    }
    if (and.length > 0) {
        return { $and: and };
    }
}

export async function random(options: FindOptions): Promise<any[]> {
    let col = db.collection('illust');
    let pipeline = [];
    let filter = getFindFilter(options, true);
    if (filter) {
        pipeline.push({ $match: filter });
    }
    pipeline.push({ $sample: { size: options.num } });
    pipeline.push({ $project: { _id: 0 } });
    let cursor = col.aggregate(pipeline);
    if (!await cursor.hasNext() && pipeline[0].$match) {
        filter = getFindFilter(options, false);
        if (filter) {
            pipeline[0].$match = filter;
            cursor = col.aggregate(pipeline);
        }
    }
    return await cursor.toArray();
}

export async function find(options: FindOptions) {
    let col = db.collection('illust');
    let filter = getFindFilter(options);
    let and = [];
    if (options.offsetOid && ObjectId.isValid(options.offsetOid)) {
        if (options.sort == 'asc') {
            and.push({ _id: { $gt: new ObjectId(options.offsetOid) } })
        } else {
            and.push({ _id: { $lt: new ObjectId(options.offsetOid) } })
        }
    }
    if (and.length > 0) {
        if (filter) {
            filter.$and = filter.$and.concat(and);
        } else {
            filter = { $and: and };
        }
    }
    let sort:any = { _id: options.sort == 'asc'? 1 : -1 };
    return await col.find(filter).sort(sort).limit(options.num).toArray();
}

export async function findByIds(ids: number[], briefMode = false): Promise<any[]> {
    if (ids.length == 0) {
        return [];
    }
    let col = db.collection('illust');
    let or = [];
    for (const id of ids) {
        or.push({ id });
    }
    let cursor = col.find({ $or: or });
    if (briefMode) {
        cursor.project({ _id:0, id: 1, page: 1 });
    } else {
        cursor.project({ _id: 0 });
    }
    return await cursor.toArray();
}

export async function insertMany(illusts: any[]): Promise<any> {
    let col = db.collection('illust');
    let oprations = [];
    for (const illust of illusts) {
        oprations.push({
            updateOne: {
                filter: { id: illust.id, page: illust.page },
                update: { $set: illust },
                upsert: true
            }
        });
    }
    let result = await col.bulkWrite(oprations);
    if (result && result.result && result.ok == 1) {
        return { upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount };
    }
}

export async function deleteMany(ids: number[]): Promise<number> {
    if (ids.length == 0) {
        return -1;
    }
    let col = db.collection('illust');
    let or = [];
    for (const id of ids) {
        or.push({ id });
    }
    let result = await col.deleteMany({ $or: or });
    if (result.acknowledged) {
        return result.deletedCount;
    }
    return -1;
}
