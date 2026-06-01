# Frontend Integration Notes

對應後端：GitHub branch `feature/ci_flow-1595269829880547028`  
後端下載時間：`20260529 11:30`

本文件記錄 `online_code_judge-main` 前端為了對接上述後端所做的修改。原則是盡量保留組員原本前端結構，只在必要處調整前端以配合新後端 API 與登入流程。

## 1. Questioner 頁面整合

整合目的：
- 將新增/管理題目的 questioner 前端頁面接入組員專案。
- 讓 `ADMIN` 可以使用 `/questioner` 管理題目。
- 不新增後端 `QUESTIONER` 角色，改由 `ADMIN` 使用 questioner 功能。

主要修改檔案：
- `src/app/(app)/questioner/page.tsx`
- `src/lib/problemApi.ts`
- `src/types/problem.ts`

重點修改：
- 將 questioner 頁面改為使用 NextAuth session。
- 權限改為只允許 `sessionUser.role === "ADMIN"`。
- 停用 Edit / Save Edit 流程，因為後端目前沒有 `PATCH /api/v1/problems/:id`。
- 保留 Create、Delete、Results。
- Results 不再呼叫不存在的統計 API，改由前端使用現有後端資料組合顯示：
  - `GET /api/v1/assignments`
  - `GET /api/v1/users/:username/submissions`
- Test cases 改以 `GET /api/v1/problems/:id` 回傳的 `sample_test_cases` 顯示。

## 2. API 對接修正

整合目的：
- 統一前端 API base URL。
- 配合後端 `api/v1` global prefix。
- 避免送出後端 DTO 不接受的欄位。

主要修改檔案：
- `src/lib/problemApi.ts`
- `.env.local`

本機環境設定：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100
NEXTAUTH_SECRET=online-code-judge-local-secret
```

API base URL 規則：
- `.env.local` 只放 host：`http://localhost:4100`
- 前端 API client 內部統一補 `/api/v1`

範例：

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100";
const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
```

已配合後端調整的 API：
- `GET /api/v1/problems`
- `GET /api/v1/problems/:id`
- `POST /api/v1/problems`
- `DELETE /api/v1/problems/:id`
- `GET /api/v1/assignments`
- `GET /api/v1/assignments/user/:userId`
- `POST /api/v1/submissions`
- `GET /api/v1/submissions/:id`
- `GET /api/v1/users/:username/submissions`

Create problem payload 修正：
- 移除後端目前不接受的欄位：
  - `allowed_languages`
  - `status`
  - `input_format`
  - `output_format`
- 保留後端 DTO 支援的欄位：
  - `title`
  - `description`
  - `difficulty`
  - `function_name`
  - `time_limit_ms`
  - `memory_limit_mb`
  - `test_cases`

Submission payload 修正：
- 移除 `assignment_id`
- 只送後端目前接受的欄位：
  - `problem_id`
  - `language`
  - `source_code`

## 3. 登入系統對接修正

整合目的：
- 使用後端 `POST /api/v1/auth/login` 登入。
- 使用後端 seed 帳號 `admin / admin123`。
- 登入成功後停在 Home，不自動跳到 questioner。

主要修改檔案：
- `src/lib/authOptions.ts`
- `src/app/sign-in/page.tsx`
- `src/app/page.tsx`
- `src/middleware.ts`
- `.env.local`

登入流程：
- 前端登入頁送出帳密。
- 前端先將密碼轉為 SHA-256 hex。
- NextAuth credentials provider 呼叫：

```txt
POST /api/v1/auth/login
```

送出 body：

```json
{
  "username": "admin",
  "passwordSha256": "<sha256 hex>"
}
```

後端回傳：

```json
{
  "token": "...",
  "expires_in": "3600",
  "user_role": "ADMIN"
}
```

前端將 `token` 存入 NextAuth session 的 `accessToken`，並將 `user_role` 存為 `session.user.role`。

登入導向修正：
- 登入成功後導回 `/`。
- Home 不再自動依角色跳轉。
- 使用者可透過 Home 的 `Go to my portal` 或上方導覽列進入功能頁。

Middleware 修正：
- 已登入使用者進入 `/sign-in` 或 `/sign-up` 時導回 `/`。
- `/` 不再由 middleware 自動重導。
- 保留受保護頁面的權限檢查：
  - `/questioner`
  - `/examiner`
  - `/candidates`
  - `/question`

## 4. 後端本機啟動時遇到的必要處理

為了讓登入測試成功，後端本機環境也需要正確初始化。

已確認需要：
- 後端需有 `.env`
- Prisma Client 需 generate
- SQLite database 需 migrate
- seed 需成功建立 `admin / admin123`

後端本機啟動參考：

```powershell
cd C:\Users\GIGABYTE\Desktop\Devop\cn_backend-feature-ci_flow
npm install
npx prisma generate
npm run db:migrate
npm run db:seed
npm run start:dev
```

前端本機啟動參考：

```powershell
cd C:\Users\GIGABYTE\Desktop\Devop\online_code_judge-main
npm install
npm run dev
```

測試帳號：

```txt
username: admin
password: admin123
```

## 5. 目前保留或尚未處理的限制

- 後端目前沒有 `PATCH /api/v1/problems/:id`，所以前端已停用 questioner edit。
- 後端目前沒有專用的 problem results 統計 endpoint，前端 Results 是由 assignments 與 submission history 組合而成。
- 後端目前角色主要是 `ADMIN` / `USER`，questioner 功能改由 `ADMIN` 使用。
- `.env.local` 為本機設定檔，預設不進版本控管。

