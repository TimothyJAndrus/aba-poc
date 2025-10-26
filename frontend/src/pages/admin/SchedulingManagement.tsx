import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Stack,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Repeat as RepeatIcon,
  ViewList as ViewListIcon,
} from '@mui/icons-material';
import {
  CalendarView,
  CalendarLegend,
  EventDetailsModal,
  RecurringSessionManager,
  BulkOperations,
} from '../../components/calendar';
import type { CalendarEvent } from '../../types';

interface SessionData extends CalendarEvent {
  clientName: string;
  rbtName: string;
  duration: number;
  notes?: string;
  conflicts?: string[];
}

interface ConflictInfo {
  type: 'time_overlap' | 'rbt_unavailable' | 'client_unavailable' | 'double_booking';
  message: string;
  severity: 'warning' | 'error';
}

export const SchedulingManagement: React.FC = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [calendarView, setCalendarView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('timeGridWeek');

  // Dialog states
  const [eventDetailsOpen, setEventDetailsOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [bulkOperationsOpen, setBulkOperationsOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Notification states
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning'>('success');
  
  // Conflict detection
  const [conflicts, setConflicts] = useState<{ [sessionId: string]: ConflictInfo[] }>({});

  // Mock data for demonstration
  const mockSessions: SessionData[] = [
    {
      id: '1',
      title: 'ABA Session - Sarah Johnson',
      start: new Date('2024-01-15T09:00:00'),
      end: new Date('2024-01-15T10:00:00'),
      type: 'session',
      status: 'scheduled',
      participants: {
        client: {
          id: '3',
          name: 'Sarah Johnson',
          email: 'sarah.parent@example.com',
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
      clientName: 'Sarah Johnson',
      rbtName: 'Mike Davis',
      duration: 60,
      notes: 'Focus on communication skills',
    },
    {
      id: '2',
      title: 'ABA Session - Tommy Wilson',
      start: new Date('2024-01-15T10:30:00'),
      end: new Date('2024-01-15T11:30:00'),
      type: 'session',
      status: 'scheduled',
      participants: {
        client: {
          id: '4',
          name: 'Tommy Wilson',
          email: 'tommy.parent@example.com',
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
      clientName: 'Tommy Wilson',
      rbtName: 'Mike Davis',
      duration: 60,
      notes: 'Behavioral intervention focus',
    },
  ];

  const mockClients = [
    { id: '3', name: 'Sarah Johnson' },
    { id: '4', name: 'Tommy Wilson' },
    { id: '5', name: 'Emma Brown' },
  ];

  const mockRBTs = [
    { id: '2', name: 'Mike Davis' },
    { id: '6', name: 'Lisa Chen' },
    { id: '7', name: 'David Rodriguez' },
  ];

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const detectConflicts = (session: SessionData, allSessions: SessionData[]): ConflictInfo[] => {
    const conflicts: ConflictInfo[] = [];
    
    // Check for time overlaps with same RBT
    const overlappingSessions = allSessions.filter(s => 
      s.id !== session.id &&
      s.participants.rbt?.id === session.participants.rbt?.id &&
      ((session.start >= s.start && session.start < s.end) ||
       (session.end > s.start && session.end <= s.end) ||
       (session.start <= s.start && session.end >= s.end))
    );

    if (overlappingSessions.length > 0) {
      conflicts.push({
        type: 'time_overlap',
        message: `RBT ${session.rbtName} has overlapping sessions`,
        severity: 'error',
      });
    }

    // Check for client double booking
    const clientConflicts = allSessions.filter(s =>
      s.id !== session.id &&
      s.participants.client?.id === session.participants.client?.id &&
      ((session.start >= s.start && session.start < s.end) ||
       (session.end > s.start && session.end <= s.end) ||
       (session.start <= s.start && session.end >= s.end))
    );

    if (clientConflicts.length > 0) {
      conflicts.push({
        type: 'double_booking',
        message: `Client ${session.clientName} has conflicting sessions`,
        severity: 'error',
      });
    }

    return conflicts;
  };

  const updateConflicts = (sessions: SessionData[]) => {
    const newConflicts: { [sessionId: string]: ConflictInfo[] } = {};
    
    sessions.forEach(session => {
      const sessionConflicts = detectConflicts(session, sessions);
      if (sessionConflicts.length > 0) {
        newConflicts[session.id] = sessionConflicts;
      }
    });
    
    setConflicts(newConflicts);
  };

  const handleDateSelect = (start: Date, _end: Date) => {
    setSelectedDate(start);
    setEditingSession(null);
    setSessionDialogOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailsOpen(true);
  };

  const handleEventDrop = (eventId: string, newStart: Date, newEnd: Date) => {
    setSessions(prev => {
      const updated = prev.map(session => 
        session.id === eventId 
          ? { ...session, start: newStart, end: newEnd }
          : session
      );
      updateConflicts(updated);
      return updated;
    });
    
    showSnackbar('Session rescheduled successfully');
  };

  const handleViewChange = (view: string) => {
    setCalendarView(view as any);
  };

  const handleSaveSession = (sessionData: Partial<SessionData>) => {
    if (editingSession) {
      // Update existing session
      setSessions(prev => {
        const updated = prev.map(session => 
          session.id === editingSession.id 
            ? { ...session, ...sessionData }
            : session
        );
        updateConflicts(updated);
        return updated;
      });
      showSnackbar('Session updated successfully');
    } else {
      // Create new session
      const newSession: SessionData = {
        id: Date.now().toString(),
        title: `ABA Session - ${sessionData.clientName}`,
        start: selectedDate || new Date(),
        end: new Date((selectedDate || new Date()).getTime() + (sessionData.duration || 60) * 60 * 1000),
        type: 'session',
        status: 'scheduled',
        participants: {
          client: mockClients.find(c => c.name === sessionData.clientName) as any,
          rbt: mockRBTs.find(r => r.name === sessionData.rbtName) as any,
        },
        color: '#2563eb',
        editable: true,
        clientName: sessionData.clientName || '',
        rbtName: sessionData.rbtName || '',
        duration: sessionData.duration || 60,
        notes: sessionData.notes,
      };
      
      setSessions(prev => {
        const updated = [...prev, newSession];
        updateConflicts(updated);
        return updated;
      });
      showSnackbar('Session created successfully');
    }
    
    setSessionDialogOpen(false);
  };



  useEffect(() => {
    setSessions(mockSessions);
    updateConflicts(mockSessions);
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Scheduling Management
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ViewListIcon />}
            onClick={() => setBulkOperationsOpen(true)}
          >
            Bulk Operations
          </Button>
          <Button
            variant="outlined"
            startIcon={<RepeatIcon />}
            onClick={() => setRecurringDialogOpen(true)}
          >
            Recurring Sessions
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedDate(new Date());
              setEditingSession(null);
              setSessionDialogOpen(true);
            }}
          >
            Add Session
          </Button>
        </Stack>
      </Box>

      {/* Conflicts Alert */}
      {Object.keys(conflicts).length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight="medium">
            {Object.keys(conflicts).length} session(s) have scheduling conflicts
          </Typography>
          <Box sx={{ mt: 1 }}>
            {Object.entries(conflicts).map(([sessionId, sessionConflicts]) => {
              const session = sessions.find(s => s.id === sessionId);
              return (
                <Typography key={sessionId} variant="caption" display="block">
                  • {session?.title}: {sessionConflicts.map(c => c.message).join(', ')}
                </Typography>
              );
            })}
          </Box>
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {/* Calendar */}
        <Box sx={{ flex: 1 }}>
          <CalendarView
            events={sessions}
            onEventClick={handleEventClick}
            onEventDrop={handleEventDrop}
            onDateSelect={handleDateSelect}
            onViewChange={handleViewChange}
            editable={true}
            selectable={true}
            initialView={calendarView}
            height={600}
          />
        </Box>

        {/* Sidebar */}
        <Box sx={{ width: 300 }}>
          <Stack spacing={2}>
            {/* Calendar Legend */}
            <CalendarLegend />

            {/* Session Statistics */}
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Today's Overview
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Total Sessions:</Typography>
                  <Chip label={sessions.length} size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Conflicts:</Typography>
                  <Chip 
                    label={Object.keys(conflicts).length} 
                    size="small" 
                    color={Object.keys(conflicts).length > 0 ? 'error' : 'success'}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Scheduled:</Typography>
                  <Chip 
                    label={sessions.filter(s => s.status === 'scheduled').length} 
                    size="small" 
                    color="primary"
                  />
                </Box>
              </Stack>
            </Paper>
          </Stack>
        </Box>
      </Box>

      {/* Event Details Modal */}
      <EventDetailsModal
        open={eventDetailsOpen}
        event={selectedEvent}
        onClose={() => setEventDetailsOpen(false)}
        onEdit={(event: CalendarEvent) => {
          const session = sessions.find(s => s.id === event.id);
          if (session) {
            setEditingSession(session);
            setSessionDialogOpen(true);
          }
        }}
        onCancel={(eventId: string, reason: string) => {
          setSessions(prev => prev.map(session => 
            session.id === eventId 
              ? { ...session, status: 'cancelled' as const }
              : session
          ));
          showSnackbar(`Session cancelled: ${reason}`);
        }}
        onReschedule={(eventId: string) => {
          const session = sessions.find(s => s.id === eventId);
          if (session) {
            setEditingSession(session);
            setSessionDialogOpen(true);
          }
        }}
        editable={true}
        userRole="admin"
      />

      {/* Recurring Session Manager */}
      <RecurringSessionManager
        open={recurringDialogOpen}
        onClose={() => setRecurringDialogOpen(false)}
        onSave={(_sessionData) => {
          // Handle recurring session creation
          showSnackbar('Recurring sessions created successfully');
          setRecurringDialogOpen(false);
        }}
        clients={mockClients}
        rbts={mockRBTs}
      />

      {/* Bulk Operations */}
      <BulkOperations
        open={bulkOperationsOpen}
        sessions={sessions}
        onClose={() => setBulkOperationsOpen(false)}
        onExecute={(_sessionIds, operation) => {
          // Handle bulk operations
          showSnackbar(`Bulk operation completed: ${operation.type}`);
          setBulkOperationsOpen(false);
        }}
        userRole="admin"
        rbts={mockRBTs}
      />

      {/* Session Dialog */}
      <SessionDialog
        open={sessionDialogOpen}
        session={editingSession}
        selectedDate={selectedDate}
        clients={mockClients}
        rbts={mockRBTs}
        onClose={() => setSessionDialogOpen(false)}
        onSave={handleSaveSession}
      />



      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert severity={snackbarSeverity} onClose={() => setSnackbarOpen(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Session Dialog Component
interface SessionDialogProps {
  open: boolean;
  session: SessionData | null;
  selectedDate: Date | null;
  clients: { id: string; name: string }[];
  rbts: { id: string; name: string }[];
  onClose: () => void;
  onSave: (sessionData: Partial<SessionData>) => void;
}

const SessionDialog: React.FC<SessionDialogProps> = ({
  open,
  session,
  selectedDate,
  clients,
  rbts,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    clientName: '',
    rbtName: '',
    date: '',
    time: '',
    duration: 60,
    notes: '',
  });

  useEffect(() => {
    if (session) {
      setFormData({
        clientName: session.clientName,
        rbtName: session.rbtName,
        date: session.start.toISOString().split('T')[0],
        time: session.start.toTimeString().slice(0, 5),
        duration: session.duration,
        notes: session.notes || '',
      });
    } else if (selectedDate) {
      setFormData({
        clientName: '',
        rbtName: '',
        date: selectedDate.toISOString().split('T')[0],
        time: selectedDate.toTimeString().slice(0, 5),
        duration: 60,
        notes: '',
      });
    }
  }, [session, selectedDate, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {session ? 'Edit Session' : 'Create New Session'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Client</InputLabel>
              <Select
                value={formData.clientName}
                label="Client"
                onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                required
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.name}>
                    {client.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>RBT</InputLabel>
              <Select
                value={formData.rbtName}
                label="RBT"
                onChange={(e) => setFormData(prev => ({ ...prev, rbtName: e.target.value }))}
                required
              >
                {rbts.map((rbt) => (
                  <MenuItem key={rbt.id} value={rbt.name}>
                    {rbt.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            
            <TextField
              label="Time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            
            <TextField
              label="Duration (minutes)"
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
              required
              fullWidth
              inputProps={{ min: 15, max: 240, step: 15 }}
            />
            
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {session ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};



export default SchedulingManagement;