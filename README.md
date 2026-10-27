# Bookbot

A monorepo for KDP book creation tools with modular architecture.

## Monorepo Structure

```
bookbot/
├── apps/
│   ├── web/              # Next.js web application (marketing + app)
│   ├── worker/           # Background worker service (export, AI, ingestion)
│   └── extension/        # Chrome extension (KDP Spy)
├── packages/
│   ├── db/               # Drizzle schema + migrations
│   ├── core/             # BSR math, trim/bleed/spine calculators
│   ├── puzzles/          # Puzzle generators (word search, sudoku, etc.)
│   └── shared/           # Zod schemas, shared types
└── turbo.json            # Turborepo configuration
```

## Getting Started

### Install dependencies

```bash
npm install
```

### Development

Run all development servers:

```bash
npm run dev
```

Run specific app:

```bash
# Web app
cd apps/web && npm run dev

# Worker
cd apps/worker && npm run dev

# Extension
cd apps/extension && npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Test

```bash
npm run test
```

### Clean

```bash
npm run clean
```

## Workspaces

This project uses npm workspaces with Turborepo for efficient build caching and task orchestration.

### Apps

- **web**: Next.js application with App Router
- **worker**: Node.js service for long-running jobs (PDF export, AI generation, data ingestion)
- **extension**: Chrome extension using WXT framework

### Packages

- **@bookbot/db**: Database schema and migrations using Drizzle ORM
- **@bookbot/core**: Core business logic (BSR calculations, trim/bleed/spine math)
- **@bookbot/puzzles**: Puzzle generation algorithms
- **@bookbot/shared**: Shared TypeScript types and Zod schemas

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Drizzle ORM
- **Cache/Queue**: Redis with BullMQ
- **Storage**: R2/S3
- **Monorepo**: Turborepo
- **Styling**: Tailwind CSS 4
- **Extension**: WXT (Manifest V3)
- **Language**: TypeScript
