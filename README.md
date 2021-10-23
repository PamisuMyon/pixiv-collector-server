# Pixiv Collector Server

包含随机图片检索API、Pixiv画作收集管理API，可作为随机图片服务单独使用。

[illust数据](https://github.com/pmisu/Pixiv-Collector-Server/releases)

[Pixiv画作收集客户端](https://github.com/pmisu/Pixiv-Collector)

# 使用
数据库：mongodb创建名为`pixiv-collector`的database，创建名为`illust`的collection并导入数据（非必须）。

配置文件`resources/app_config.json`：
```json
{
    // mongodb 地址
    "mongoUri": "mongodb://127.0.0.1:27017/pixiv-collector",
    // 是否启用画作管理相关接口  
    "enableIllustManage": true,
    // 默认图片代理，将替换图片url中的"i.pximg.net" 
    "defaultImageProxy": "i.pixiv.cat",
    // 对于多页画作，仅收集其首页或全部收集（临时，之后需要客户端支持指定页收集）
    "collectSinglePage": true
}
```

初始化并运行：
```bash
npm install

npx tsc --watch false

npm start
```

出现如下输出说明运行成功：
```
Connecting to database...
Connected to database.
Pixiv Collector Server listening on port 7007.
```

# 通用API
## 随机图片检索
**URL**: /api/v1/illust

**请求方式**：GET POST

**参数**
| 参数         | 类型   | 默认值   | 说明                                       |
| -------------- | -------- | ----------- | -------------------------------------------- |
| r18            | number   | 0           | `0`非r18 `1`r18 `2`我全都要             |
| num            | number   | 1           | 期望返回画作数量，最大值30       |
| tags           | string[] |             | 标签列表，标签之间为与关系      |
| maxSanityLevel | number   | 0           | 画作的最高色色等级，`0`为不作限制          |
| fallback       | boolean  | false       | `true`没有匹配结果时，不返回空列表而是返回随机结果 |
| proxy          | string   | i.pixiv.cat | 图片代理，用于替换图片url中的i.pximg.net |

POST请求时参数为json格式。tags的检索为先精确匹配，若无结果再模糊匹配。

**返回结果**
| 字段   | 类型  | 说明                     |
| -------- | ------- | -------------------------- |
| code     | number  | code                       |
| msg      | string  | message                    |
| count    | number  | 画作数量               |
| fallback | boolean | 是否无匹配并返回了随机结果 |
| data     | any[]   | 画作信息               |

**请求示例**

POST body
```
{
    "r18": 2,
    "num": 20,
    "tags": ["魔理沙", "灵梦"]
}
```

返回结果

```
{
    "code": 0,
    "msg": null,
    "count": 16,
    "fallback": false,
    "data": [
        {
            "id": 85087116,
            "page": 0,
            "author_id": 54259522,
            "author_name": "JILL。",
            "create_date": "2020-10-18T14:27:37+09:00",
            "height": 1448,
            "page_count": 1,
            "r18": 0,
            "sanity_level": 2,
            "tags": [
                "博麗霊夢",
                "博丽灵梦",
                "霧雨魔理沙",
                "雾雨魔理沙",
                "東方Project",
                "东方Project",
                "レイマリ",
                "主角组（灵魔）",
                "主角组",
                "百合",
                "yuri",
                "東方獣化娘",
                "猫耳",
                "cat ears",
                "東方Project1000users入り",
                "东方Project 1000收藏",
                "東方",
                "东方",
                "少女猫化中"
            ],
            "title": "ฅ^•ω•^ฅ",
            "urls": {
                "medium": "https://i.pixiv.cat/c/540x540_70/img-master/img/2020/10/18/14/27/37/85087116_p0_master1200.jpg",
                "large": "https://i.pixiv.cat/c/600x1200_90/img-master/img/2020/10/18/14/27/37/85087116_p0_master1200.jpg",
                "original": "https://i.pixiv.cat/img-original/img/2020/10/18/14/27/37/85087116_p0.jpg",
                "regular": "https://i.pixiv.cat/img-master/img/2020/10/18/14/27/37/85087116_p0_master1200.jpg"
            },
            "width": 2048
        },
        ...
    ]
}
```

## 画作信息查询
**URL**: /api/v1/illust/info

**请求方式**：POST

**参数**
| 参数         | 类型   | 默认值   | 说明                                       |
| -------------- | -------- | ----------- | -------------------------------------------- |
| ids            | string[]     |            | 要查询的画作id列表             |
| briefMode      | boolean   | false       | `true`仅返回画作id与页码         |

参数为json格式。

**返回结果**
| 字段   | 类型  | 说明                     |
| -------- | ------- | -------------------------- |
| code     | number  | code                       |
| msg      | string  | message                    |
| data     | any[]   | 画作信息               |

# 管理API
## 收录

对应客户端收录功能。

**URL**: /api/v1/illust

**请求方式**：PUT

**参数**

json数组，包含从Pixiv APP API 获取到的illust数据。

**返回结果**
| 字段   | 类型  | 说明                     |
| -------- | ------- | -------------------------- |
| code     | number  | code                       |
| msg      | string  | 数据更新情况                |

## 移除

对应客户端移除功能。

**URL**: /api/v1/illust

**请求方式**：DELETE

**参数**

json数组，包含要删除的画作id。

**返回结果**
| 字段   | 类型  | 说明                     |
| -------- | ------- | -------------------------- |
| code     | number  | code                       |
| msg      | string  | 数据更新情况                |

## 查询

对应客户端已收录功能。

**URL**: /api/v1/illust/list

**请求方式**：POST

**参数**
| 参数         | 类型   | 默认值 | 说明                      |
| -------------- | -------- | ------ | --------------------------- |
| r18            | number   | 0      | `0`非r18 `1`r18 `2`我全都要 |
| num            | number   | 1      | 每页数量，最大值30  |
| tags           | string[] |        | 标签列表，标签之间为与关系 |
| maxSanityLevel | number   | 0      | 画作的最高色色等级，`0`为不作限制 |
| offsetOid      | string   |        | 分页起始记录oid       |
| sort           | string   | desc   | `asc`收录时间升序，`desc`降序       |

参数为json格式。

**返回结果**
| 字段   | 类型  | 说明                     |
| -------- | ------- | -------------------------- |
| code     | number  | code                       |
| msg      | string  | message                    |
| count    | number  | 作品数量               |
| data     | any[]   | 作品信息               |

