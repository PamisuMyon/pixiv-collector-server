import { ObjectId } from 'bson';
import { db } from './db';

export enum MatchMode {
    ACCURACY = 'accuracy',  // accuracy first
    TAGS = 'tags',    // tags first
}

export interface FindOptions {
    num: number;
    r18?: number;
    tags?: string[];
    excludedTags?: string[];
    matchMode?: MatchMode;
    maxSanityLevel?: number;
    offsetOid?: string;
    sort?: string;
    returnTotalSample?: boolean;
    clientId?: string;
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
                and.push({ tags: { $regex: tag, $options:'i' } })
            }
        }
    }
    if (options.excludedTags && options.excludedTags.length > 0) {
        and.push({ tags: { $nin: options.excludedTags }});
    }
    if (options.maxSanityLevel > 1) {
        and.push({ sanity_level: { $lte: options.maxSanityLevel } });
    }
    if (and.length > 0) {
        return { $and: and };
    }
}

function getIdsFilter(tags: string[]) {
    let ids = [];
    for (const tag of tags) {
        let num = parseInt(tag);
        if (!isNaN(num)) {
            ids.push(num);
        }
    }
    if (ids.length > 0) {
        return { id: { $in: ids } };
    }
}

function getTagsFilter(tags: string[], accurate = false) {
    if (accurate) {
        return [{ tags: { $all: tags } }];
    } else {
        let and = [];
        for (const tag of tags) {
            and.push({ tags: { $regex: tag, $options:'i' } })
        }
        return and;
    }
}

function getAuthorOrTitleFilter(tags: string[], accurate = false) {
    if (accurate) {
        return { 
            $or: [ 
                { author_name: { $in: tags } },
                { title: { $in: tags } }
            ]
        };
    } else {
        let or = [];
        for (const tag of tags) {
            or.push({ author_name: { $regex: tag, $options:'i' } })
            or.push({ title: { $regex: tag, $options:'i' } })
        }
        return { $or: or };
    }
}

function getRecordsLookupStages(clientId: string, num: number) {
    return [
        {
            $addFields: {
                lookupId: {
                    $concat: [
                        { $toString: '$id' }, '/',
                        { $toString: '$page' }, '/',
                        clientId
                    ]
                }
            }
        },
        {
            $lookup: {
                from: 'records',
                localField: 'lookupId',
                foreignField: 'id',
                as: 'records'
            }
        },
        {
            $unwind: {
                path: '$records',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $addFields: {
                lastRequestTime: '$records.lastRequestTime'
            }
        },
        {
            $addFields: {
                lastRequestTime: { $ifNull: [ '$lastRequestTime', new Date('') ] } 
            }
        },
        {
            $sort: {
                'lastRequestTime': 1,
                'create_date': -1
            }
        },
        {
            $limit: num
        },
        {
            $project: {
                lookupId: 0,
                records: 0,
            }
        }
    ];
}

export async function random(options: FindOptions): Promise<{totalSample: number, data: any[]}> {
    let col = db.collection('illust');

    /* 
    Pipeline stages
    When options.returnTotalSample is true:
    Pipeline 1
        $match
        $count
    Pipeline 2
        $match
        $sample

    When options.returnTotalSample && options.clientId are true:
    Pipeline 1
        $match
        $count
    Pipeline 2
        $match
        $lookup records
        $sort by lastRequestTime 1
        $sample

    When options.returnTotalSample is false:
    Pipeline 1
        $match
        $sample
    */
    let pipeline = [];
    let baseAnd = [];
    if (options.r18 == 0 || options.r18 == 1) {
        baseAnd.push({ r18: options.r18 });
    }
    if (options.maxSanityLevel > 1) {
        baseAnd.push({ sanity_level: { $lte: options.maxSanityLevel } });
    }
    if (options.excludedTags && options.excludedTags.length > 0) {
        baseAnd.push({ tags: { $nin: options.excludedTags }});
    }
    pipeline.push({ $match: { } });
    if (baseAnd.length > 0) {
        pipeline[0].$match = { $and: baseAnd };
    }

    let hasTags = options.tags && options.tags.length > 0;
    if (options.returnTotalSample && hasTags) {
        pipeline.push({ $count: 'totalSample'});
    } else {
        pipeline.push({ $sample: { size: options.num } });
        pipeline.push({ $project: { _id: 0 } });
    }

    if (hasTags) {
        let filters: any[][];
        if (options.matchMode == MatchMode.TAGS) {
            // id > accurate tags > fuzzy tags > accurate author or title > fuzzy author or title
            filters = [
                getTagsFilter(options.tags, true),
                getTagsFilter(options.tags, false),
                [getAuthorOrTitleFilter(options.tags, true)],
                [getAuthorOrTitleFilter(options.tags, false)],
            ];
        } else {
            // id > accurate tags > accurate author or title > fuzzy tags > fuzzy author or title
            filters = [
                getTagsFilter(options.tags, true),
                [getAuthorOrTitleFilter(options.tags, true)],
                getTagsFilter(options.tags, false),
                [getAuthorOrTitleFilter(options.tags, false)],
            ];
        }
        let idsFilter = getIdsFilter(options.tags);
        if (idsFilter) {
            filters.splice(0, 0, [idsFilter]);
        }
        
        for (const filter of filters) {
            filter.push(...baseAnd);
            pipeline[0].$match = { $and: filter };
            // console.dir(pipeline[0].$match);
            let cursor = col.aggregate(pipeline);
            if (options.returnTotalSample) {
                if (await cursor.hasNext()) {
                    const result = await cursor.next();
                    if (result.totalSample > 0) {

                        console.dir(options.tags);
                        console.log(`Profile: illustDao.random ${options.clientId} : ${result.totalSample}`)
                        console.time('illustDao.random');

                        pipeline.pop();
                        if (options.clientId && result.totalSample < 15000) { // hard-code 
                            pipeline.push(...getRecordsLookupStages(options.clientId, options.num));
                        } else {
                            pipeline.push({ $sample: { size: options.num } });
                            pipeline.push({ $project: { _id: 0 } });
                        }
                        cursor = col.aggregate(pipeline);
                        const results = await cursor.toArray();

                        console.timeEnd('illustDao.random');
                        return { totalSample: result.totalSample, data: results };
                    }
                }
            } else {
                if (await cursor.hasNext()) {
                    return {totalSample: -1, data: await cursor.toArray()};
                }
            }
        }
    } else {
        let cursor = col.aggregate(pipeline);
        return {totalSample: -1, data: await cursor.toArray()};
    }
}

export async function record(clientId: string, illusts: any[]) {
    if (!illusts || illusts.length == 0) return;
    const col = db.collection('records');
    const oprations = [];
    for (const illust of illusts) {
        const record = {
            id: `${illust.id}/${illust.page}/${clientId}`,
            illustId: illust.id,
            illustPage: illust.page,
            clientId: clientId,
            lastRequestTime: new Date(),
        };
        oprations.push({
            updateOne: {
                filter: { id: record.id },
                update: { $set: record },
                upsert: true
            }
        });
    }
    const result = await col.bulkWrite(oprations);
    if (result && result.result && result.ok == 1) {
        return { upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount };
    }
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
