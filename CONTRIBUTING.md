# Contributing to VibeFlow

Thank you for working on VibeFlow! This guide explains how to set up your development environment, follow our coding conventions, and verify your changes before opening a pull request.

## 1. Local Development Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Install dependencies (`npm install`) and ensure `.env` is configured from `.env.example`.
3. Start the full-stack server (`npm run dev`).

## 2. Code Style & Architectural Rules

- **No Demo Data**: Never hardcode fake users, songs, playlists, or fabricated analytics in production code.
- **Validation First**: Every new API endpoint must validate inputs using a Zod schema in `backend/src/validators/schemas.ts`.
- **Server-Side Ownership**: Always verify `resource.ownerId === req.user._id` in controllers before reading, updating, or deleting user resources.
- **No Secrets in Git**: Never commit `.env` files, API keys, or real passwords.

## 3. Verification Checklist Before Submitting a PR

Run all verification suites and confirm they pass:

```bash
npm run typecheck
npm test
npm run test:python
npm run build
```
