# Express + TypeScript Production Template

A production-ready Express.js backend template with TypeScript, featuring security, observability, and database request logging.

## Features

- **TypeScript-first** - Strongly typed with strict TypeScript configuration
- **Security** - Helmet, CORS, rate limiting, bcrypt password hashing, JWT authentication
- **Logging** - Pino structured logging with request correlation IDs + database persistence
- **Database** - Prisma ORM with PostgreSQL, automatic migrations
- **Authentication** - JWT + Basic auth for admin endpoints
- **Error Handling** - Centralized error handling with typed API responses
- **DevOps** - Multi-stage Dockerfile, GitHub Actions CI/CD
- **Graceful Shutdown** - Proper connection cleanup on SIGTERM/SIGINT

## Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd express-template
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and secrets
   ```

3. **Set up database:**
   ```bash
   npm run db:push
   npm run db:generate
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## API Endpoints

### Authentication
- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user

### Users (JWT required)
- `GET /api/users/me` - Get current user
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get user by ID (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Health & Monitoring
- `GET /api/health` - Health check
- `GET /api/logs` - Request logs (basic auth required)

## Environment Variables

See `.env.example` for all required environment variables.

## Docker

Build and run with Docker:
```bash
docker build -t express-template .
docker run -p 3000:3000 express-template
```

## Production Deployment

The template includes a complete CI/CD pipeline with:
- Automated testing and linting
- Security scanning
- Multi-architecture Docker builds
- Container registry publishing

Ready for deployment to any container orchestration platform.

## License

MIT