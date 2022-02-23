import { getAppConfig } from './config';
import { loggerror } from './logger';

export function illustsToDb(illusts: any[]): any[] {
    let items = [];
    for (const illust of illusts) {
        try {
            let item: any = {
                id: illust.id,
                title: illust.title,
                author_id: illust.user.id,
                author_name: illust.user.name,
                author_account: illust.user.account,
                create_date: illust.create_date,
                sanity_level: illust.sanity_level,
                width: illust.width,
                height: illust.height,
                tags: [],
                r18: 0,
                page_count: illust.page_count,
                page: 0,
                urls: {}
            }

            // tag
            for (const t of illust.tags) {
                if (t.name && item.tags.indexOf(t.name) == -1) {
                    item.tags.push(t.name);
                }
                if (t.translated_name && item.tags.indexOf(t.translated_name) == -1) {
                    item.tags.push(t.translated_name);
                    let index = t.translated_name.search(/[（\(]/);
                    if (index != -1) {
                        // 拆分人物名称与作品
                        let name = t.translated_name.slice(0, index).trim();
                        if (name != '' && item.tags.indexOf(name) == -1) {
                            item.tags.push(name);
                        }
                    }
                }
            }

            // r18
            if (illust.x_restrict == 1 || item.tags.indexOf('R-18') != -1) {
                item.r18 = 1;
            }

            if (item.page_count > 1) {
                for (let i = 0; i < illust.meta_pages.length; i++) {
                    let itemClone: any;
                    if (i == 0) {
                        itemClone = item;
                    } else {
                        itemClone = JSON.parse(JSON.stringify(item));
                    }
                    itemClone.page = i;
                    let imageUrls = illust.meta_pages[i].image_urls;
                    itemClone.urls = {
                        medium: imageUrls.medium,
                        large: imageUrls.large,
                        original: imageUrls.original
                    };
                    itemClone.urls = illust.meta_pages[i].image_urls;
                    items.push(itemClone);
                    if (getAppConfig().collectSinglePage) {
                        break;
                    }
                }
            } else {
                item.urls = {
                    medium: illust.image_urls.medium,
                    large: illust.image_urls.large,
                    original: illust.meta_single_page.original_image_url
                };
                items.push(item);
            }
        } catch (error) {
            loggerror.error('Raw illust parse error.')
            loggerror.error(error);
        }
    }
    return items;
}