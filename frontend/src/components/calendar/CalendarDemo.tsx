import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  Alert,
} from '@mui/material';
import {
  CalendarView,
  CalendarLegend,
  EventDetailsModal,
  SessionCard,
  RecurringSessionManager,
  BulkOperations,
} from './index';
import type { CalendarEvent } from '../../types';
import { addDays, addHours } from 'date-fns';

export const CalendarDemo: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [bulkOperationsOpen, setBulkOperationsOpen] = useState(false);

  // Mock data
  const mockEvents: CalendarEvent[] = [
    {
      id: '1',
      title: 'ABA Session - Sarah Johnson',
      start: new Date(),
      end: addHours(new Date(), 1),
      type: 'session',
      status: 'scheduled',
      participants: {
        client: {
          id: '1',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          role: 'client',
          preferences: {
            theme: 'light',
            notifications: {
              email: true,
              push: true,
              scheduleChanges: true,
              reminders: true,
              systemAlerts: false,
            },
            defaultCalendarView: 'month',
            timezone: 'UTC',
          },
          lastLogin: new Date(),
        },
        rbt: {
          id: '2',
          name: 'Mike Davis',
          email: 'mike@example.com',
          role: 'employee',
          preferences: {
            theme: 'light',
            notifications: {
              email: true,
              push: false,
              scheduleChanges: true,
              reminders: true,
              systemAlerts: false,
            },
            defaultCalendarView: 'week',
            timezone: 'UTC',
          },
          lastLogin: new Date(),
        },
      },
      color: '#2563eb',
      editable: true,
    },
    {
      id: '2',
      title: 'ABA Session - Tommy Wilson',
      start: addDays(new Date(), 1),
      end: addDays(addHours(new Date(), 1), 1),
      type: 'session',
      status: 'scheduled',
      participants: {
        client: {
          id: '3',
          name: 'Tommy Wilson',
          email: 'tommy@example.com',
          role: 'client',
          preferences: {
            theme: 'light',
            notifications: {
              email: true,
              push: true,
              scheduleChanges: true,
              reminders: true,
              systemAlerts: false,
            },
            defaultCalendarView: 'month',
            timezone: 'UTC',
          },
          lastLogin: new Date(),
        },
        rbt: {
          id: '2',
          name: 'Mike Davis',
          email: 'mike@example.com',
          role: 'employee',
          preferences: {
            theme: 'light',
            notifications: {
              email: true,
              push: false,
              scheduleChanges: true,
              reminders: true,
              systemAlerts: false,
            },
            defaultCalendarView: 'week',
            timezone: 'UTC',
          },
          lastLogin: new Date(),
        },
      },
      color: '#059669',
      editable: true,
    },
  ];

  const mockClients = [
    { id: '1', name: 'Sarah Johnson' },
    { id: '3', name: 'Tommy Wilson' },
  ];

  const mockRBTs = [
    { id: '2', name: 'Mike Davis' },
    { id: '4', name: 'Lisa Chen' },
  ];

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Calendar Components Demo
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        This demo showcases the calendar and scheduling components implemented for task 10.
        Features include drag-and-drop scheduling, conflict detection, recurring sessions, and bulk operations.
      </Alert>

      <Stack spacing={3}>
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setRecurringDialogOpen(true)}
          >
            Create Recurring Sessions
          </Button>
          <Button
            variant="outlined"
            onClick={() => setBulkOperationsOpen(true)}
          >
            Bulk Operations
          </Button>
        </Box>

        {/* Main Calendar */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <CalendarView
              events={mockEvents}
              onEventClick={handleEventClick}
              onEventDrop={(eventId, newStart, newEnd) => {
                console.log('Event dropped:', { eventId, newStart, newEnd });
              }}
              onDateSelect={(start, end) => {
                console.log('Date selected:', { start, end });
              }}
              editable={true}
              selectable={true}
              height={500}
            />
          </Box>

          <Box sx={{ width: 300 }}>
            <CalendarLegend />
          </Box>
        </Box>

        {/* Session Cards Demo */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Session Cards
          </Typography>
          <Stack spacing={2}>
            {mockEvents.map((event) => (
              <SessionCard
                key={event.id}
                session={event}
                variant="list"
                showActions={true}
                onEdit={(sessionId) => console.log('Edit session:', sessionId)}
                onCancel={(sessionId) => console.log('Cancel session:', sessionId)}
                onReschedule={(sessionId) => console.log('Reschedule session:', sessionId)}
                userRole="admin"
              />
            ))}
          </Stack>
        </Paper>
      </Stack>

      {/* Event Details Modal */}
      <EventDetailsModal
        open={eventDetailsOpen}
        event={selectedEvent}
        onClose={() => setEventDetailsOpen(false)}
        onEdit={(event) => console.log('Edit event:', event)}
        onCancel={(eventId, reason) => console.log('Cancel event:', eventId, reason)}
        onReschedule={(eventId) => console.log('Reschedule event:', eventId)}
        editable={true}
        userRole="admin"
      />

      {/* Recurring Session Manager */}
      <RecurringSessionManager
        open={recurringDialogOpen}
        onClose={() => setRecurringDialogOpen(false)}
        onSave={(sessionData) => {
          console.log('Recurring sessions created:', sessionData);
          setRecurringDialogOpen(false);
        }}
        clients={mockClients}
        rbts={mockRBTs}
      />

      {/* Bulk Operations */}
      <BulkOperations
        open={bulkOperationsOpen}
        sessions={mockEvents}
        onClose={() => setBulkOperationsOpen(false)}
        onExecute={(sessionIds, operation) => {
          console.log('Bulk operation:', { sessionIds, operation });
          setBulkOperationsOpen(false);
        }}
        userRole="admin"
        rbts={mockRBTs}
      />
    </Box>
  );
};

export default CalendarDemo;