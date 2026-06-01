# Online Code Judge Frontend

此版本為 `online_code_judge-main` 前端，已調整為可和 `cn_backend-master` 的 `/api/v1` 後端 API 整合使用。後端程式碼不需要為本次前端整合修改；前端透過環境變數指定後端網址。

## 本版更新重點

### 1. 後端 API 整合

- 前端 API base URL 改由 `NEXT_PUBLIC_API_BASE_URL` 控制。
- 預設後端為 `http://localhost:4100`。
- 所有主要 API 都會走後端全域 prefix：

```txt
/api/v1
```

建議前端 `.env.local`：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100
NEXTAUTH_SECRET=online-code-judge-local-secret
```

### 2. 登入與 Session

- 登入使用後端：

```txt
POST /api/v1/auth/login
```

- 前端會先將密碼轉成 SHA-256 hex，再送出 `passwordSha256`。
- 登入成功後會將後端 JWT 存入 NextAuth session 的 `accessToken`。
- 前端會解析 JWT payload，使用 `sub` 作為目前登入者的 user id。
- 支援後端角色：

```txt
ADMIN
EXAMINER
QUESTIONER
CANDIDATE
USER
```

### 3. Questioner 題目管理

Questioner 頁面已改為使用後端題目 API：

```txt
GET    /api/v1/problems
GET    /api/v1/problems/:id
POST   /api/v1/problems
PATCH  /api/v1/problems/:id
DELETE /api/v1/problems/:id
```

更新內容：

- 題目列表與題目詳細資料從後端載入。
- 建立題目會轉換成後端 DTO 格式：
  - `title`
  - `description`
  - `difficulty`
  - `function_name`
  - `time_limit_ms`
  - `memory_limit_mb`
  - `test_cases`
- 支援後端回傳的 `creator` 欄位。
- Questioner Console 允許 `ADMIN` 與 `QUESTIONER` 進入。
- Results 會透過 assignments 與 user submissions 組合出候選人提交狀態。

### 4. Examiner 面試與指派流程

Examiner 頁面已可與後端面試、候選人、指派 API 整合：

```txt
POST   /api/v1/interviews
GET    /api/v1/interviews
PATCH  /api/v1/interviews/:id
DELETE /api/v1/interviews/:id
POST   /api/v1/interview-candidates
GET    /api/v1/interview-candidates
DELETE /api/v1/interview-candidates/:id
POST   /api/v1/assignments
GET    /api/v1/assignments
DELETE /api/v1/assignments/:id
```

更新內容：

- 新增面試時只送後端允許的欄位。
- 後端會從 JWT 判斷 examiner/admin 身分，不需要前端送 `examinerEmpId`。
- 可新增候選人到面試。
- 可將題目指派給候選人。
- 可移除候選人或指派紀錄。

### 5. Candidate 面試作答流程

Candidate flow 已調整為只使用候選人有權限讀取的 API，不再依賴 admin/examiner 才能讀取的全站資料。

Candidate dashboard 使用：

```txt
GET /api/v1/assignments/user/:userId
```

更新內容：

- bob/alice 等候選人登入後，會用自己的 user id 讀取被指派的題目。
- `/candidates/:id` 會從 assignments 組出面試列表。
- `/candidates/:id/:jobId` 會列出該面試內被指派的題目。
- 點擊題目後進入：

```txt
/question/:problemId
```

注意：如果候選人只是被加入面試，但尚未被指派任何題目，後端目前沒有 candidate 可讀的空面試列表 API，因此前端不會顯示該空面試。請先在 examiner 頁面替候選人指派至少一題。

### 6. 題目作答、Run 與 Submit

題目頁已整合：

```txt
POST /api/v1/judge/run
POST /api/v1/submissions
GET  /api/v1/submissions/:id
```

更新內容：

- `Run` 會呼叫後端 sample judge。
- `Submit` 會建立 submission，並輪詢 submission 結果。
- Candidate 進入題目頁時，會用自己的 assignments 確認是否有該題權限。
- 移除後端目前不支援的 Java 選項。
- 目前語言選項：
  - Python
  - C++
  - JavaScript

## 本機啟動

### 後端

```powershell
cd C:\Users\GIGABYTE\Desktop\Devop\cn_backend-master
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run start:dev
```

後端健康檢查：

```powershell
Invoke-RestMethod http://localhost:4100/api/v1/health
```

### 前端

```powershell
cd C:\Users\GIGABYTE\Desktop\Devop\online_code_judge-main
npm install
npm run dev
```

打開：

```txt
http://localhost:3000
```

## 測試帳號

可使用後端 seed 帳號：

```txt
admin / admin123
alice / user123
bob / user123
```

常見測試流程：

1. 使用 `admin` 登入。
2. 建立 interview。
3. 將 `bob` 加入該 interview。
4. 指派至少一題給 `bob`。
5. 登出後使用 `bob / user123` 登入。
6. 進入 candidate dashboard，確認可看到 interview 與題目。
7. 點進題目後執行 Run 或 Submit。

## 驗證狀態

已執行：

```powershell
npm run lint
```

結果：通過，僅有專案既有 warning。


