import { MongoClient, Db} from 'mongodb';
import { getAppConfig } from '../common/config';

let client: MongoClient;
export let db: Db;

export async function connect() {
    let uri = getAppConfig().mongoUri;
    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    // db.command({ping: 1});
}