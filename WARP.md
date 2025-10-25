# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is an Angular proof-of-concept project (aba-poc). The repository is currently in its initial stages.

## Environment

- Angular: 19.x
- Angular CLI: 19.2.10
- Node.js version: (to be determined once project is initialized)

## Development Commands

### Initial Setup
```bash
# Install dependencies (once package.json exists)
npm install

# Start development server
ng serve

# Build for production
ng build --configuration production
```

### Testing
```bash
# Run all tests
ng test

# Run tests in headless mode (CI)
ng test --browsers=ChromeHeadless --watch=false

# Run a specific test file
ng test --include='**/path/to/file.spec.ts'

# Run end-to-end tests
ng e2e
```

### Code Quality
```bash
# Lint code
ng lint

# Format code (if prettier is configured)
npm run format
```

## Architecture Notes

This section will be populated as the project architecture is established.

### When Adding Components
- Use Angular CLI to generate components: `ng generate component <name>`
- Follow Angular style guide conventions
- Components should be organized by feature modules where appropriate

### When Adding Services
- Generate services with: `ng generate service <name>`
- Services should be provided in the appropriate module or use `providedIn: 'root'` for singleton services

## Project Structure

```
aba-poc/
├── src/
│   ├── app/           # Application source code
│   ├── assets/        # Static assets
│   └── environments/  # Environment configurations
└── angular.json       # Angular workspace configuration
```

(Structure will be updated as the project develops)
