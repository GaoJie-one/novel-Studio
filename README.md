# Novel Studio

Novel Studio 是中文小说生成工具，当前同时承担 Web 应用和微信小程序 API 后端。Web 端使用 Next.js + Supabase，微信小程序通过 Bearer token 调用同一组生成和作品接口。

## 当前状态

- Web 端包含登录、创作、章节编辑、历史记录。
- 小程序可调用微信登录、小说生成、云端作品保存/读取/删除接口。
- 生成接口使用 OpenAI 兼容 LLM 配置，并按用户记录每日生成额度。

## 启动

```bash
npm install
npm run dev
```

打开：

```bash
http://127.0.0.1:3000
```

## 关键环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL_NAME=
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_SESSION_SECRET=
WECHAT_DAILY_GENERATION_LIMIT=5
WEB_DAILY_GENERATION_LIMIT=20
```

`WECHAT_SESSION_SECRET` 必须是独立随机长字符串，不要复用 Supabase 或 LLM 密钥。

## 小程序 API

```text
POST /api/wechat/login
POST /api/generate/novel
POST /api/generate/quality
GET  /api/wechat/projects
POST /api/wechat/projects
DELETE /api/projects/:projectId
```

小程序登录后保存 `/api/wechat/login` 返回的 `token`，后续请求带：

```text
Authorization: Bearer <token>
```

## 数据库

Web 项目和小程序作品共用 `projects`、`chapters` 表。微信用户的 `openid` 会在后端派生为稳定 UUID，用作 `user_id`。部署前执行：

```sql
supabase/migrations/0001_generation_usage.sql
```

该迁移创建 `generation_usage` 表和 `consume_generation_quota` 函数，用于每日生成额度。

## 部署提示

部署到 Vercel 后，在微信公众平台配置小程序 request 合法域名。生产环境不要把 LLM Key、微信 AppSecret 或 Supabase service role key 写入前端代码。
