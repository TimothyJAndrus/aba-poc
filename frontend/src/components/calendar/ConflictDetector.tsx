import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Warning,
  Schedule,
  Person,
  LocationOn,
} from '@mui/icons-material';
import { CalendarEvent } from '../../types';
import { format, isEqual, isBefore, isAfter } from 'date-fns';

interface ConflictInfo {
  type: 'time_overlap' | 'rbt_double_booking' | 'client_double_booking' | 'location_conflict';
  severity: 'warning' | 'error';
  message: string;
  conflictingEvents: CalendarEvent[];
}

interface ConflictDetectorProps {
  events: CalendarEvent[];
  newEvent?: {
    start: Date;
    end: Date;
    rbtId?: string;
    clientId?: string;
    location?: string;
  };
  excludeEventId?: string;
  onConflictsDetected?: (conflicts: ConflictInfo[]) => void;
  showAlert?: boolean;
}

export const ConflictDetector: React.FC<ConflictDetectorProps> = ({
  events,
  newEvent,
  excludeEventId,
  onConflictsDetected,
  showAlert = true,
}) => {
  const detectConflicts = (): ConflictInfo[] => {
    const conflicts: ConflictInfo[] = [];
    
    if (!newEvent) return conflicts;

    const relevantEvents = events.filter(
      (event) => 
        event.id !== excludeEventId && 
        event.status !== 'cancelled' &&
        event.type === 'session'
    );

    // Check for time overlaps
    const timeOverlaps = relevantEvents.filter((event) => {
      const eventStart = event.start;
      const eventEnd = event.end;
      const newStart = newEvent.start;
      const newEnd = newEvent.end;

      // Check if times overlap
      return (
        (newStart >= eventStart && newStart < eventEnd) ||
        (newEnd > eventStart && newEnd <= eventEnd) ||
        (newStart <= eventStart && newEnd >= eventEnd)
      );
    });

    if (timeOverlaps.length > 0) {
      conflicts.push({
        type: 'time_overlap',
        severity: 'error',
        message: `Time slot conflicts with ${timeOverlaps.length} existing session(s)`,
        conflictingEvents: timeOverlaps,
      });
    }

    // Check for RBT double booking
    if (newEvent.rbtId) {
      const rbtConflicts = relevantEvents.filter((event) => {
        const rbtId = event.participants.rbt?.id;
        return rbtId === newEvent.rbtId && timeOverlaps.includes(event);
      });

      if (rbtConflicts.length > 0) {
        conflicts.push({
          type: 'rbt_double_booking',
          severity: 'error',
          message: 'RBT is already scheduled for another session at this time',
          conflictingEvents: rbtConflicts,
        });
      }
    }

    // Check for client double booking
    if (newEvent.clientId) {
      const clientConflicts = relevantEvents.filter((event) => {
        const clientId = event.participants.client?.id;
        return clientId === newEvent.clientId && timeOverlaps.includes(event);
      });

      if (clientConflicts.length > 0) {
        conflicts.push({
          type: 'client_double_booking',
          severity: 'error',
          message: 'Client is already scheduled for another session at this time',
          conflictingEvents: clientConflicts,
        });
      }
    }

    // Check for location conflicts
    if (newEvent.location) {
      const locationConflicts = relevantEvents.filter((event) => {
        // Assuming location is stored in event title or extended props
        const eventLocation = event.title.includes(newEvent.location!) || 
          (event as any).location === newEvent.location;
        return eventLocation && timeOverlaps.includes(event);
      });

      if (locationConflicts.length > 0) {
        conflicts.push({
          type: 'location_conflict',
          severity: 'warning',
          message: 'Location may be occupied by another session',
          conflictingEvents: locationConflicts,
        });
      }
    }

    // Notify parent component
    if (onConflictsDetected) {
      onConflictsDetected(conflicts);
    }

    return conflicts;
  };

  const conflicts = detectConflicts();

  if (!showAlert || conflicts.length === 0) {
    return null;
  }

  const getConflictIcon = (type: ConflictInfo['type']) => {
    switch (type) {
      case 'time_overlap':
        return <Schedule />;
      case 'rbt_double_booking':
      case 'client_double_booking':
        return <Person />;
      case 'location_conflict':
        return <LocationOn />;
      default:
        return <Warning />;
    }
  };

  const getSeverityColor = (severity: ConflictInfo['severity']) => {
    return severity === 'error' ? 'error' : 'warning';
  };

  return (
    <Box sx={{ mt: 2 }}>
      {conflicts.map((conflict, index) => (
        <Alert
          key={index}
          severity={getSeverityColor(conflict.severity)}
          sx={{ mb: 1 }}
          icon={getConflictIcon(conflict.type)}
        >
          <AlertTitle>
            {conflict.severity === 'error' ? 'Scheduling Conflict' : 'Potential Issue'}
          </AlertTitle>
          
          <Typography variant="body2" gutterBottom>
            {conflict.message}
          </Typography>

          {conflict.conflictingEvents.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Conflicting sessions:
              </Typography>
              <List dense sx={{ py: 0 }}>
                {conflict.conflictingEvents.map((event) => (
                  <ListItem key={event.id} sx={{ py: 0.5, px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Schedule fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">
                            {event.title}
                          </Typography>
                          <Chip
                            label={event.status}
                            size="small"
                            variant="outlined"
                            color={event.status === 'scheduled' ? 'success' : 'default'}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption">
                          {format(event.start, 'MMM d, h:mm a')} - {format(event.end, 'h:mm a')}
                          {event.participants.client && ` • ${event.participants.client.name}`}
                          {event.participants.rbt && ` • ${event.participants.rbt.name}`}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Alert>
      ))}
    </Box>
  );
};

export default ConflictDetector;