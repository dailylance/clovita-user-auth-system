You are an expert backend engineer. Generate a complete, ready-to-run production-grade Express + TypeScript backend template repository that follows best practices for scalability, security, observability and developer ergonomics. Output ONLY the repository file tree with full file contents (no extra commentary). The repo must be runnable after `npm install` and include multi-stage Dockerfile, a GitHub Actions CI workflow, and tests.

Requirements and constraints:
- Node LTS, TypeScript, Express (latest stable). Use minimal but well-supported libraries.
- Project must be TypeScript-first and strongly typed. No any for public types.
- Use pino for structured logging and include request-id correlation (attach request id to logs).
- Centralized config using dotenv with `env.example`.
- Implement robust error handling middleware with typed API error responses (HTTP status, code, message, details).
- Implement Basic auth using best tools so it scalable and best and free. Keep secrets in env.
- Provide security middleware: helmet, cors, rate-limiter, compression.
- Add graceful shutdown on SIGINT/SIGTERM and proper connection close hooks (DB, message queues).
- Add GitHub Actions workflow that runs lint, build, test, and outputs coverage.
- Provide a clear folder layout: `src/controllers`, `src/services`, `src/middleware`, `src/routes`, `src/lib` (logger, config, db), `src/types`. and structure must be simple not too complex.
- Use Prisma OR to Connect with database ORM
- Provide example environment variables and `.env.example`.
- Provide clear npm scripts: `build`, `start`, `dev`, `lint`.
- Keep production settings secure by default (no hard-coded secrets).
- log each request in database table which can log everything like a pro level logging so we can know everything about api request 
- use all latest version of each package
- no need of documation and no test framework like jest 

Output format:
- Print the repository tree and each file content in a way that can be recreated exactly (e.g., show file paths and full contents).
- Do NOT include explanations outside the repo content.
- Keep code concise but complete and runnable.

Performance/security extras (must include):
- Use pino-http with log level via env.
- Add request-logging and error logging context.
- Use helmet with sane defaults + CORS config read from env.
- Rate limit with express-rate-limit and allow override via env.
- Ensure input validation errors map to 400 with structured error body.
- Provide a simple middleware to add a correlation ID (use `x-request-id`) if absent.

Make the generated repository production-ready and easy to extend by an engineering team.