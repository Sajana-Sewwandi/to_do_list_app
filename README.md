# To-Do List API

A NestJS REST API for user registration, JWT authentication, and user-owned task management. Data is stored in MySQL through TypeORM.

The project also includes a React + Zustand web client in `frontend/`. It uses the NestJS API for authentication and task management.

## Features

- User registration with bcrypt password hashing
- JWT login tokens that expire after one hour
- Protected task CRUD endpoints
- Per-user task access: users can only list, update, delete, or reorder their own tasks
- Task validation with `class-validator`
- MySQL schema synchronized automatically during local development
- Redis-backed per-user task-list cache with automatic invalidation
- Unit tests for `TasksService`

## Requirements

- Node.js 20.19 or newer is recommended
- npm

## Setup

Install dependencies:

```bash
npm install
```

The project reads environment variables from `.env`. A local `.env` file is included for development; replace its JWT secret before deploying. You can copy `.env.example` when setting up another environment.

To override the JWT signing secret for the current shell:

PowerShell:

```powershell
$env:JWT_SECRET = "replace-with-a-long-random-secret"
```

macOS/Linux:

```bash
export JWT_SECRET="replace-with-a-long-random-secret"
```

The application has a development fallback secret, but `JWT_SECRET` must be set in any non-development environment.

## Run the application

Start in watch mode for development:

```bash
npm run start:dev
```

The server listens on `http://localhost:8080` with the included `.env` file. Set the `PORT` environment variable to use a different port.

## Run the web client locally

In a second terminal, start the React development server:

```bash
npm run client:dev
```

Open `http://localhost:5173`. Vite proxies `/auth` and `/tasks` calls to the NestJS server at `http://localhost:8080`, which matches the included `.env` configuration. Start the NestJS server first with `npm run start:dev`.

The client provides registration, login, persistent session state, task CRUD, and drag-and-drop task tiles. Each drop calls `PUT /tasks/reorder` to persist the new order. Build the client with:

```bash
npm run client:build
```

## Run the full stack with Docker

Docker Compose starts the React web server, NestJS API, MySQL, and Redis as one isolated stack. The browser communicates with the web container at `http://localhost:8080`; Nginx proxies `/auth` and `/tasks` to the internal API service.

1. Install and start Docker Desktop.
2. Create a Docker-specific environment file:

   PowerShell:

   ```powershell
   Copy-Item .env.docker.example .env.docker
   ```

   macOS/Linux:

   ```bash
   cp .env.docker.example .env.docker
   ```

3. Edit `.env.docker` and replace `JWT_SECRET`, `DB_PASSWORD`, and `MYSQL_ROOT_PASSWORD` with strong values.
4. Build and start every service:

   ```bash
   docker compose --env-file .env.docker up --build -d
   ```

5. Open `http://localhost:8080` and register an account.

Useful Docker commands:

```bash
# Follow backend logs
docker compose --env-file .env.docker logs -f api

# Check all service states
docker compose --env-file .env.docker ps

# Stop the stack while retaining MySQL and Redis data volumes
docker compose --env-file .env.docker down

# Stop the stack and delete all container data
docker compose --env-file .env.docker down -v
```

The MySQL and Redis data are kept in named Docker volumes. The API is private to the Compose network; only the web application is published to the host.

Other commands:

```bash
# Start once without watch mode
npm run start

# Build TypeScript into dist/
npm run build

# Run the compiled application
npm run start:prod
```

## Database

The project uses MySQL. Configure the `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_NAME` values in `.env`. TypeORM has `synchronize: true` enabled, so tables are created and updated automatically when the application starts.

This setting is convenient for local development. Use migrations instead of `synchronize` for production deployments.

## Redis task-list cache

Redis caches each authenticated user's `GET /tasks` response for five minutes under the key `tasks:user:<userId>`. MySQL remains the source of truth.

The cache is removed immediately after that user creates, updates, deletes, or reorders a task, so the next list request reads fresh data from MySQL and repopulates Redis. Reorder validation always reads MySQL directly rather than relying on the cache.

Start Redis locally with Docker:

```bash
docker run --name taskflow-redis -p 6379:6379 -d redis:7-alpine
```

Set the connection URL in `.env`:

```env
REDIS_URL=redis://localhost:6379
```

If `REDIS_URL` is omitted or Redis is temporarily unavailable, the API continues to serve requests from MySQL; caching is skipped. To test caching with Redis running, log in, call `GET /tasks` twice, then run `redis-cli GET tasks:user:<userId>`. Create, update, delete, or reorder a task and confirm that `redis-cli GET tasks:user:<userId>` returns `(nil)` until the next `GET /tasks` repopulates it.

## API

### Health check

```http
GET /
```

Returns `Hello World!`.

### Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "alex@example.com",
  "password": "strong-password",
  "name": "Alex"
}
```

Successful response (`201 Created`):

```json
{
  "id": 1,
  "email": "alex@example.com",
  "name": "Alex"
}
```

The password is hashed with bcrypt before storage. Registering an existing email returns `409 Conflict`.

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "alex@example.com",
  "password": "strong-password"
}
```

Successful response (`200 OK`):

```json
{
  "access_token": "<jwt>"
}
```

Invalid credentials return `401 Unauthorized`.

### Authentication for task routes

All `/tasks` endpoints require the access token from login:

```http
Authorization: Bearer <access_token>
```

The JWT strategy reads the token subject and attaches it as `request.user.userId`. Task queries are scoped to that ID.

### List tasks

```http
GET /tasks
Authorization: Bearer <access_token>
```

Returns only the authenticated user's tasks, in the user's saved custom order.

### Create a task

```http
POST /tasks
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "title": "Finish API documentation",
  "description": "Document all task endpoints",
  "status": "in-progress",
  "dueDate": "2026-08-01T09:00:00.000Z"
}
```

`status` is optional and defaults to `todo`.

### Reorder tasks

```http
PUT /tasks/reorder
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "taskIds": [3, 1, 2]
}
```

`taskIds` must contain every task owned by the authenticated user exactly once, in the desired order. The response returns the tasks in their newly saved order. Task IDs belonging to another user, duplicate IDs, and omitted IDs return `400 Bad Request`.

### Update a task

```http
PUT /tasks/1
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "status": "done"
}
```

All update fields are optional. A task that does not belong to the authenticated user returns `404 Not Found`.

### Delete a task

```http
DELETE /tasks/1
Authorization: Bearer <access_token>
```

Returns `204 No Content` when successful. Tasks can only be deleted by their owner.

## Task input rules

Task request bodies are validated and unknown fields are removed.

| Field | Create | Update | Rule |
| --- | --- | --- | --- |
| `title` | Required | Optional | Non-empty string |
| `description` | Required | Optional | Non-empty string |
| `status` | Optional | Optional | `todo`, `in-progress`, or `done` |
| `dueDate` | Required | Optional | ISO 8601 date string |
| `taskIds` | N/A | Reorder only | Non-empty array of unique integer task IDs; must include all of the user's tasks |

## Tests

Run all unit tests:

```bash
npm test
```

Run only the task service tests:

```bash
npm test -- --runInBand src/tasks/tasks.service.spec.ts
```

Run with coverage:

```bash
npm run test:cov
```

The `TasksService` tests mock the TypeORM repository and Redis cache. They cover task creation, ownership-scoped updates/deletion, task-list cache hits and misses, cache invalidation after mutations, and task reordering.

## Useful commands

```bash
# Check and automatically fix lint issues
npm run lint

# Format source and test files
npm run format

# Run end-to-end HTTP tests
npm run test:e2e
```

The end-to-end suite starts a NestJS HTTP application with mocked database and cache services. It verifies auth routes, authenticated task routing, task DTO validation, and the reorder endpoint without requiring local MySQL or Redis.
