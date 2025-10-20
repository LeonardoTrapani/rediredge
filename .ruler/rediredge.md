# Rediredge project rules

This is a rediredge project created with Better-T-Stack CLI.

## Project Structure

This is a monorepo with the following structure:

- **`apps/web/`** - Fullstack application

- **`packages/api/`** - Shared API logic and types
- **`packages/auth/`** - Authentication logic and utilities
- **`packages/db/`** - Database schema and utilities

## Build/Lint/Test Commands

- `bun run build` - Build all packages
- `bun run check` - Lint and format code with Biome
- `bun run check-types` - Type check across workspace
- No test framework configured yet; run individual tests manually if added

## Code Style Guidelines

- **Formatting:** Use tabs for indentation, double quotes for strings
- **Imports:** Organize imports automatically (Biome assist)
- **Types:** Strict TypeScript; use explicit types, avoid `any`
- **Naming:** camelCase for variables/functions, PascalCase for components/types, kebab-case for files
- **Error Handling:** Use try-catch for async operations; throw descriptive errors
- **Linting:** Follow Biome rules (recommended + custom); no unused vars, inferrable types, etc.

## Database Commands

All database operations should be run from the web workspace:

- `bun run db:push` - Push schema changes to database
- `bun run db:studio` - Open database studio
- `bun run db:generate` - Generate Drizzle files
- `bun run db:migrate` - Run database migrations

Database schema files are located in `apps/web/src/db/schema/`

## API Structure

- tRPC routers are in `packages/api/src/routers/`
- Client-side tRPC utils are in `apps/web/src/utils/trpc.ts`

## Authentication

Authentication is enabled in this project:

- Server auth logic is in `packages/auth/src/lib/auth.ts`
- Web app auth client is in `apps/web/src/lib/auth-client.ts`

## Key Points

- This is a Turborepo monorepo using bun workspaces
- Each app has its own `package.json` and dependencies
- Run commands from the root to execute across all workspaces
- Run workspace-specific commands with `bun run command-name`
- Turborepo handles build caching and parallel execution
- **Never run dev commands** (e.g., `bun run dev`)
