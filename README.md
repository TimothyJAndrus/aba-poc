# Automated ABA Scheduling System

A comprehensive scheduling system for managing Applied Behavior Analysis (ABA) therapy sessions between Registered Behavioral Therapists (RBTs) and clients with autism spectrum disorders.

## Features

- **Intelligent Scheduling**: Constraint-based scheduling with continuity preferences
- **Automatic Rescheduling**: Handle cancellations and RBT unavailability
- **Team Management**: Manage RBT-client team assignments
- **Real-time Updates**: WebSocket-based live schedule updates
- **Comprehensive Reporting**: Analytics and audit trails
- **Multi-channel Notifications**: Email, SMS, and in-app notifications

## Project Structure

```
src/
├── config/           # Application configuration
├── controllers/      # API route controllers
├── database/         # Database connection and repositories
│   └── repositories/ # Data access layer
├── models/          # Data models and interfaces
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions and helpers
└── test/            # Test setup and utilities
```

## Core Entities

- **User**: Base user entity with role-based access
- **RBT**: Registered Behavioral Therapist with qualifications and availability
- **Client**: Children receiving ABA therapy services
- **Team**: Groups of RBTs assigned to specific clients
- **Session**: 3-hour therapy appointments
- **AvailabilitySlot**: RBT availability windows
- **ScheduleEvent**: Audit trail for all scheduling changes

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Redis 6+
- TypeScript 5+

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration

5. Build the project:
   ```bash
   npm run build
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

### Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Configuration

The system uses environment variables for configuration. See `.env.example` for all available options.

### Key Configuration Areas

- **Database**: PostgreSQL connection settings
- **Redis**: Cache and session storage
- **JWT**: Authentication token configuration
- **Scheduling**: Business hours and constraints
- **Notifications**: Email and SMS service settings

## Business Rules

### Scheduling Constraints

- Sessions are 3 hours long
- Business hours: Monday-Friday, 9 AM - 7 PM
- No double-booking of RBTs or clients
- RBTs must be assigned to client teams

### Continuity Preferences

- Prioritize RBTs with recent client history
- Consider total session count with client
- Maintain therapeutic relationships

### Rescheduling Logic

- Automatic reassignment within 10 minutes
- Prefer team members with client experience
- Maintain session duration and constraints

## API Endpoints

The system provides RESTful APIs for:

- Session scheduling and management
- RBT and client management  
- Team assignments
- Availability management
- Reporting and analytics
- Real-time notifications

## Testing

The project includes comprehensive testing:

- Unit tests for business logic
- Integration tests for API endpoints
- Database operation tests
- Scheduling algorithm validation

Run tests with:
```bash
npm test
```

## Contributing

1. Follow TypeScript best practices
2. Maintain test coverage above 80%
3. Use conventional commit messages
4. Update documentation for new features

## License

MIT License - see LICENSE file for details