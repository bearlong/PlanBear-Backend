# Plan Bear Enterprise Platform - Frontend

## 1. 專案簡介

Plan Bear Enterprise Platform 是一套企業管理系統 Demo，主要展示：

- RFQ 詢價管理
- Workflow 簽核流程
- Instrument Calibration 儀器校驗
- Role-Based Access Control
- Mock Authentication

本專案由企業內部系統重構而來，所有資料均已完成去識別化與 Mock 化，可公開展示。

## 2. 系統架構

```text
Client (Next.js)
        │
        │ HTTP / Cookie / Bearer Token
        ▼
Express API Server
        │
        ├── Middleware
        │     ├── Authentication
        │     ├── Authorization
        │     ├── Validation
        │     └── Error Handling
        │
        ├── Routes
        │
        ├── Controllers
        │
        ├── Services
        │
        ├── Repositories
        │
        ├── Mock Repositories
        │
        └── Optional (Non-Mock Mode)
              ├── Supabase
              ├── Microsoft SQL Server
              └── Enterprise Services
```

### 核心流程

1. `app.js` 初始化 Express middleware、CORS、session、Swagger 與 JWT 驗證。
2. `routes/` 下的 API 會被自動掛載到 `/api/<route-name>`。
3. Route 負責 request parsing、權限前置檢查與 response formatting。
4. Service layer 封裝校驗、簽核、通知、批次更新等商業邏輯。
5. Repository layer 封裝資料存取。
6. `USE_MOCK=true` 時，模組改用 in-memory mock data，降低公開展示與本機開發門檻。

## 3. 技術架構

- Runtime: Node.js, ES Modules
- Web Framework: Express.js
- Authentication: JWT, cookie-parser, express-session
- API Documentation: swagger-jsdoc, swagger-ui-express
- Database Clients: Supabase JavaScript Client, MSSQL
- File Upload: multer
- Excel Processing: exceljs, xlsx
- Scheduling: node-cron
- Logging: morgan, winston
- Email / FTP Integrations: nodemailer, basic-ftp
- Security Utilities: argon2, jsonwebtoken
- Environment Management: dotenv, cross-env

## 4. API Modules

Routes are dynamically mounted under `/api`.

| Module                  | Base Path                                                                                                                                              | Description                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Auth                    | `/api/login`, `/api/logout`                                                                                                                            | Login, MFA flow, demo role selection, JWT cookie issuance                                |
| Users & Permissions     | `/api/users`, `/api/permission`                                                                                                                        | User lookup, role/module/form/attachment permission data                                 |
| Department Tree         | `/api/depts`                                                                                                                                           | Organization tree, department users, user search, select options                         |
| Factory Mapping         | `/api/factories`, `/api/user-factory`                                                                                                                  | Factory list and user-factory preference mapping                                         |
| RFQ Reference Data      | `/api/vendors`, `/api/brands`, `/api/parts`, `/api/buyers`, `/api/origin-countries`, `/api/sap-sourcer`, `/api/last-price`                             | Master data used by procurement and RFQ workflows                                        |
| RFQ Compare Data        | `/api/compare-data`                                                                                                                                    | Compare data query, draft creation, draft copy and delete                                |
| RFQ Application         | `/api/compare-apply`                                                                                                                                   | Application query, draft query, create application, create version, update status        |
| Excel Import            | `/api/data`                                                                                                                                            | File template/download and Excel import support                                          |
| Pending Tasks           | `/api/pending-task`                                                                                                                                    | User pending workflow tasks                                                              |
| Favorites               | `/api/favorites`                                                                                                                                       | User shortcut/favorite function settings                                                 |
| Signature               | `/api/signature`                                                                                                                                       | Signature task lookup                                                                    |
| Calibration Instruments | `/api/Calibration/calibration`                                                                                                                         | Instrument list, detail, history, statistics, reports, status update, approval/rejection |
| Calibration Repair      | `/api/Calibration/repair`                                                                                                                              | Repair application query, create, update, and attachment handling                        |
| Calibration Settings    | `/api/Calibration/calibration-list`, `/api/Calibration/calibration-orgs`, `/api/Calibration/instrument-systems`, `/api/Calibration/notice-member-list` | Calibration master data and notification member maintenance                              |

Swagger UI is available at:

```text
http://localhost:3005/api-docs
```

## 5. Mock 策略

本專案採用 **Mock First** 策略，方便公開展示與本機開發。

啟用方式：

```env
USE_MOCK=true
NODE_ENV=local
```

啟用 Mock 模式後，系統將：

- 模組皆不連接 Supabase 與 Microsoft SQL Server。
- 提供 Demo 帳號登入（固定密碼：`1234`）。
- 透過 `/api/login/demo-roles` 與 `/api/login/select-role` 模擬不同角色登入。
- 提供詢比價所需的 Buyer、Vendor、Brand、Part、Factory、Origin Country、歷史價格等範例資料。
- 使用 `configs/mockCompareStore.js` 暫存詢比價申請與草稿資料。
- 使用記憶體（In-Memory）模擬儀校設備、歷程、維修申請、通知成員、校驗廠商及設定資料。
- 不會呼叫正式環境的 Email、FTP、Active Directory、MFA、SAP、Workflow 或其他企業服務。

> Mock 資料皆存放於記憶體中，重新啟動伺服器後，執行期間新增或修改的資料將會還原。

## 6. 已移除的企業系統整合

原始專案曾整合多項企業內部系統。為了能夠公開展示，本版本已將相關功能移除、Mock 化或完成去識別化處理。

公開版本不包含以下正式環境整合：

- Active Directory（AD）身分驗證
- MFA／推播驗證流程
- Workflow 簽核服務
- SAP、PDM、FTP 等企業系統整合
- Supabase 與 Microsoft SQL Server 正式環境連線資訊
- 正式環境 Email 通知內容與收件人
- 真實使用者、部門、供應商、料號及儀校資料

為保留系統架構與程式設計概念，公開版本仍保留部分抽象化介面（如 Service、Repository 等），並以 Mock 或範例資料取代正式企業系統，方便展示系統設計與開發流程。

## 7. Getting Started

### Prerequisites

- Node.js 18 or later
- Yarn 1.x or npm

### Install dependencies

```bash
yarn install
```

or:

```bash
npm install
```

## Configure Environment

建立 `.env` 檔案：

### Demo Mode（推薦）

Demo 模式使用 Mock Repository，不需要任何資料庫或企業系統。

```env
PORT=3005
NODE_ENV=local
USE_MOCK=true
JWT_SECRET_KEY=replace-with-local-secret
JWT_SECRET_KEY_MFA=replace-with-local-mfa-secret
DB_SCHEMA=demo
```

### Optional: Enterprise Integration

若需要自行串接其他資料來源，可另外提供相對應的環境變數。

以下僅列出支援的設定名稱，**不包含任何正式環境資訊**。

```env
SMTP_HOST=
SMTP_TO_EMAIL=

ACCESS_TOKEN_SECRET=
OTP_SECRET=

SUPABASE_URL=
SUPABASE_KEY=

MSSQL_USER=
MSSQL_PASSWORD=
MSSQL_SERVER=
MSSQL_DATABASE=
MSSQL_PORT=1433

PDMSQL_USER=
PDMSQL_PASSWORD=
PDMSQL_SERVER=
PDMSQL_DATABASE=

BPM_URL=

FTP_HOST=
FTP_PORT=21
FTP_USER=
FTP_PASSWORD=

AD_URL=
AD_BASE_DN=
```

> 公開版本不包含任何正式環境的連線資訊、API Key 或企業系統憑證。
> 如需使用 Database Mode，請自行建立對應的資料來源。

### Run locally

```bash
yarn local
```

or:

```bash
npm run local
```

Default local URL:

```text
http://localhost:3005
```

API docs:

```text
http://localhost:3005/api-docs
```

## 8. 專案結構

```text
.
├── app.js                     # Express 初始化、Middleware、JWT 驗證、Route 掛載
├── bin/
│   └── www.js                 # HTTP Server 啟動入口
├── configs/                   # 環境設定、資料庫連線、Mock Store
├── data/
│   └── uploads/               # 上傳檔案目錄
├── jobs/                      # 排程工作
├── repositories/              # Repository Layer（資料存取）
├── routes/                    # API 路由
├── services/                  # Service Layer（商業邏輯）
├── utils/                     # 共用工具
├── views/                     # Pug 預設頁面
├── Dockerfile
├── package.json
└── README.md
```

## 9. 設計理念

### Dynamic Route Mounting（動態路由掛載）

系統啟動時會自動掃描 `routes/` 目錄並掛載 API，新增模組時無需手動修改主程式，可降低維護成本並提升擴充性。

### Mock First（Mock 優先）

公開版本預設採用 Mock Repository，不需連接任何企業系統或資料庫，即可展示完整的系統流程，方便作品集展示與本機開發。

### Controller / Service / Repository 分層架構

系統採用 Controller、Service、Repository 分層設計：

- Controller：負責接收 Request 與回傳 Response。
- Service：負責商業邏輯處理。
- Repository：負責資料存取。

透過分層設計，可降低模組間耦合度，提升程式的可維護性、可測試性與擴充性。

### JWT 驗證機制

系統同時支援 Cookie 與 Bearer Token 驗證方式，方便與 Web 前端及 API Client 整合。

### 權限管理（RBAC）

使用 Role-Based Access Control（RBAC）概念管理系統權限，依照模組、功能及操作項目控制使用者可執行的動作，方便日後擴充不同角色的權限設定。

### Mock Repository

公開版本以 Mock Repository 取代正式資料來源，所有資料皆存放於記憶體中，可模擬新增、修改、刪除等操作流程，而不需建立資料庫。

### 環境隔離

系統會依據環境設定切換執行模式。Mock 模式下不會呼叫正式環境的 Email、排程、Workflow 或其他企業服務，避免公開版本誤連正式系統。

## 10. 已知限制

- Mock 資料僅存放於記憶體，重新啟動後將會重置。
- Swagger 文件尚未涵蓋所有 API。
- 公開版本不包含企業系統整合。
- 未提供自動化測試。
- 僅作為作品集展示，不建議直接用於正式環境。

## 11. 聲明

本專案為企業內部系統之作品集版本。

所有公司名稱、網域、使用者、部門、料號、供應商、設備資料、Workflow、API、帳號密碼及系統整合均已去識別化、Mock 化或移除。

本專案僅供展示程式設計能力、系統架構及開發流程，不代表任何正式企業系統。

## 12. 作者

Bear Shen
- GitHub： https://github.com/bearlong
- Linkedin： https://www.linkedin.com/in/cheng-long-shen-1843082b7/
- email： a86774546@gmail.com


### 專長

- Full-stack Web Development
- Enterprise Workflow System
- RESTful API Design

### 技術

- JavaScript
- React
- Next.js
- Express.js
- Node.js
- Supabase
- Microsoft SQL Server

## 專案特色

- Repository Pattern
- Service Layer
- Mock First Architecture
- Role-Based Access Control (RBAC)
- JWT Authentication
- RESTful API
- Dynamic Route Mounting
- Swagger API Documentation
