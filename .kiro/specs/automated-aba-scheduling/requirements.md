# Requirements Document

## Introduction

The Automated ABA Scheduling System is designed to efficiently pair registered behavioral therapists (RBTs) with clients who are children on the autism spectrum. The system manages 3-hour therapy sessions scheduled Monday through Friday from 9am to 7pm, prioritizing continuity of care by maintaining consistent RBT-client pairings while providing automated rescheduling capabilities when disruptions occur.

## Glossary

- **ABA_Scheduling_System**: The automated scheduling application for behavioral therapy sessions
- **RBT**: Registered Behavioral Therapist - licensed employees who provide direct therapy services
- **Client**: A child on the autism spectrum receiving ABA therapy services
- **Session**: A 3-hour therapy appointment between an RBT and a client
- **Team**: A group of RBTs assigned to work with a specific client
- **Schedule_Disruption**: Any event that requires rescheduling (client cancellation, RBT unavailability, sick leave, vacation)
- **Continuity_Preference**: The system's priority to maintain consistent RBT-client pairings
- **Business_Hours**: Monday through Friday, 9:00 AM to 7:00 PM
- **Automatic_Rescheduling**: The system's ability to reassign sessions without manual intervention

## Requirements

### Requirement 1

**User Story:** As a scheduling coordinator, I want the system to automatically schedule therapy sessions, so that clients receive consistent care with minimal manual intervention.

#### Acceptance Criteria

1. THE ABA_Scheduling_System SHALL schedule sessions during Business_Hours only
2. THE ABA_Scheduling_System SHALL assign each Session a duration of exactly 3 hours
3. WHEN scheduling a new Session, THE ABA_Scheduling_System SHALL prioritize RBTs from the Client's assigned Team
4. THE ABA_Scheduling_System SHALL maintain a record of all scheduled Sessions with Client, RBT, date, and time information
5. THE ABA_Scheduling_System SHALL prevent double-booking of RBTs or Clients for overlapping time slots

### Requirement 2

**User Story:** As a therapy provider, I want the system to maintain consistent RBT-client pairings, so that clients receive continuity of care and build therapeutic relationships.

#### Acceptance Criteria

1. WHEN multiple RBTs from a Client's Team are available for a time slot, THE ABA_Scheduling_System SHALL select the RBT with the most recent Session history with that Client
2. THE ABA_Scheduling_System SHALL track the frequency of RBT-Client pairings for each Client
3. THE ABA_Scheduling_System SHALL generate reports showing Continuity_Preference metrics for each Client
4. WHERE an RBT has worked with a Client in the previous week, THE ABA_Scheduling_System SHALL prioritize that RBT for future Sessions with the same Client

### Requirement 3

**User Story:** As a scheduling coordinator, I want the system to automatically reschedule sessions when clients cancel, so that RBT time is efficiently utilized and other clients can receive services.

#### Acceptance Criteria

1. WHEN a Client cancels a Session, THE ABA_Scheduling_System SHALL mark the Session as cancelled within 5 minutes
2. WHEN a Session is cancelled, THE ABA_Scheduling_System SHALL identify other Clients who could utilize the available RBT and time slot
3. THE ABA_Scheduling_System SHALL automatically propose alternative Sessions for the available RBT within 10 minutes of cancellation
4. THE ABA_Scheduling_System SHALL send notifications to relevant parties when automatic rescheduling occurs
5. THE ABA_Scheduling_System SHALL maintain a log of all Schedule_Disruptions and resulting changes

### Requirement 4

**User Story:** As an RBT, I want the system to handle my unavailability (sick leave, vacation), so that my clients are automatically reassigned to available team members.

#### Acceptance Criteria

1. WHEN an RBT reports unavailability, THE ABA_Scheduling_System SHALL identify all affected Sessions within 5 minutes
2. THE ABA_Scheduling_System SHALL reassign affected Sessions to available RBTs from the same Client Teams
3. WHILE reassigning Sessions due to RBT unavailability, THE ABA_Scheduling_System SHALL maintain Continuity_Preference by selecting RBTs with previous experience with each affected Client
4. THE ABA_Scheduling_System SHALL notify affected Clients and their families of RBT changes at least 2 hours before the scheduled Session
5. THE ABA_Scheduling_System SHALL update the schedule and send confirmations to newly assigned RBTs within 15 minutes of reassignment

### Requirement 5

**User Story:** As a clinic administrator, I want the system to manage RBT team assignments for clients, so that appropriate therapists are available for each client's needs.

#### Acceptance Criteria

1. THE ABA_Scheduling_System SHALL maintain a Team roster of qualified RBTs for each Client
2. THE ABA_Scheduling_System SHALL allow administrators to add or remove RBTs from Client Teams
3. THE ABA_Scheduling_System SHALL verify RBT qualifications and availability before adding them to any Team
4. WHEN a Team assignment changes, THE ABA_Scheduling_System SHALL update future Session assignments accordingly
5. THE ABA_Scheduling_System SHALL maintain historical records of Team assignments for each Client