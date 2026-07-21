# TaskFlow Architecture

```mermaid
flowchart LR
    Client[Postman / Frontend Client]
    API[NestJS API]

    subgraph NestJS[NestJS Application]
        Auth[AuthModule<br/>Register / Login<br/>bcrypt + JWT]
        Tasks[TasksModule<br/>Task CRUD operations]
        Guard[JWT Auth Guard + Strategy]
        ORM[TypeORM]
    end

    DB[(MySQL Database)]

    Client -->|POST /auth/register<br/>email, password, name| API
    Client -->|POST /auth/login<br/>email, password| API
    API -->|Register and login requests| Auth
    Auth -->|User data / password hash| ORM
    ORM -->|SQL query via TypeORM| DB
    Auth -->|JWT access token| API
    API -->|JWT access token| Client

    Client -->|Bearer JWT token +<br/>/tasks CRUD request| API
    API -->|Protected task request| Guard
    Guard -->|Valid token: userId attached to request| Tasks
    Tasks -->|Task data scoped to userId| ORM
    ORM -->|SQL query via TypeORM| DB
    DB -->|User and task records| ORM
    ORM -->|Task records| Tasks
    Tasks -->|Task API response| API
    API -->|JSON response| Client
```

> Note: the current project is configured with SQLite (`database.sqlite`). This diagram uses MySQL as requested; changing to MySQL would require updating the TypeORM configuration and installing a MySQL driver.
