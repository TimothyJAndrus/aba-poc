import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Alert,
  Snackbar,
  Fab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Add,
  MoreVert,
  CalendarToday,
  AccessTime,
  Person,
  Cancel,
  Schedule,
  CheckCircle,
  Pending,
} from '@mui/icons-material';
import { useClientDashboard } from '../../hooks';
import {
  SessionCancellationDialog,
  AdditionalSessionRequestDialog,
  SessionRescheduleDialog,
} from '../../components/client';
import type { ClientSession, SessionCancellationRequest, AdditionalSessionRequest } from '../../types';
import { format, isToday, isTomorrow, isPast } from 'date-fns';

export const SessionManagement: React.FC = () => {
  const {
    child,
    upcomingSessions,
    recentSessions,
    error,
    refreshData,
  } = useClientDashboard();

  // Dialog states
  const [cancellationDialog, setCancellationDialog] = useState<{
    open: boolean;
    session: ClientSession | null;
  }>({ open: false, session: null });

  const [rescheduleDialog, setRescheduleDialog] = useState<{
    open: boolean;
    session: ClientSession | null;
  }>({ open: false, session: null });

  const [additionalSessionDialog, setAdditionalSessionDialog] = useState(false);

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSession, setSelectedSession] = useState<ClientSession | null>(null);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'success' });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, session: ClientSession) => {
    setAnchorEl(event.currentTarget);
    setSelectedSession(session);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSession(null);
  };

  const handleCancelSession = (request: SessionCancellationRequest) => {
    // TODO: Implement API call
    console.log('Cancel session:', request);
    setCancellationDialog({ open: false, session: null });
    setSnackbar({
      open: true,
      message: 'Session cancellation request submitted successfully',
      severity: 'success',
    });
    refreshData();
  };

  const handleRescheduleSession = (sessionId: string, newTimeSlotId: string, reason: string) => {
    // TODO: Implement API call
    console.log('Reschedule session:', { sessionId, newTimeSlotId, reason });
    setRescheduleDialog({ open: false, session: null });
    setSnackbar({
      open: true,
      message: 'Session reschedule request submitted successfully',
      severity: 'success',
    });
    refreshData();
  };

  const handleAdditionalSessionRequest = (request: AdditionalSessionRequest) => {
    // TODO: Implement API call
    console.log('Additional session request:', request);
    setAdditionalSessionDialog(false);
    setSnackbar({
      open: true,
      message: 'Additional session request submitted successfully',
      severity: 'success',
    });
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd');
  };

  const getStatusColor = (status: ClientSession['status']) => {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: ClientSession['status']) => {
    switch (status) {
      case 'scheduled':
        return <Pending />;
      case 'completed':
        return <CheckCircle />;
      case 'cancelled':
        return <Cancel />;
      case 'in-progress':
        return <Schedule />;
      default:
        return <Pending />;
    }
  };

  const canModifySession = (session: ClientSession) => {
    return session.status === 'scheduled' && !isPast(new Date(session.startTime));
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Session Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your child's therapy sessions - view, cancel, or reschedule appointments
          </Typography>
        </Box>
      </Box>

      {/* Upcoming Sessions */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          Upcoming Sessions
        </Typography>
        
        {upcomingSessions.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <CalendarToday sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Upcoming Sessions
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                You don't have any scheduled sessions at the moment.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setAdditionalSessionDialog(true)}
              >
                Request Session
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Box display="grid" gap={2}>
            {upcomingSessions.map((session) => (
              <Card key={session.id} variant="outlined">
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="h6">
                          {session.sessionType}
                        </Typography>
                        <Chip
                          label={session.status}
                          size="small"
                          color={getStatusColor(session.status)}
                          icon={getStatusIcon(session.status)}
                        />
                      </Box>
                      
                      <Box display="flex" flexDirection="column" gap={1} mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {getDateLabel(new Date(session.startTime))} - {format(new Date(session.startTime), 'EEEE, MMMM dd, yyyy')}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {format(new Date(session.startTime), 'h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            RBT: {session.rbtName}
                          </Typography>
                        </Box>
                      </Box>

                      {session.notes && (
                        <Typography variant="body2" color="text.secondary">
                          Notes: {session.notes}
                        </Typography>
                      )}
                    </Box>

                    {canModifySession(session) && (
                      <IconButton
                        onClick={(e) => handleMenuOpen(e, session)}
                        size="small"
                      >
                        <MoreVert />
                      </IconButton>
                    )}
                  </Box>
                </CardContent>

                {canModifySession(session) && (
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Schedule />}
                      onClick={() => setRescheduleDialog({ open: true, session })}
                    >
                      Reschedule
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<Cancel />}
                      onClick={() => setCancellationDialog({ open: true, session })}
                    >
                      Cancel
                    </Button>
                  </CardActions>
                )}
              </Card>
            ))}
          </Box>
        )}
      </Box>

      {/* Recent Sessions */}
      <Box mb={4}>
        <Typography variant="h6" gutterBottom>
          Recent Sessions
        </Typography>
        
        {recentSessions.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="body2" color="text.secondary">
                No recent sessions found
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <List>
              {recentSessions.map((session, index) => (
                <React.Fragment key={session.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: `${getStatusColor(session.status)}.main` }}>
                        {getStatusIcon(session.status)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2">
                            {session.sessionType}
                          </Typography>
                          <Chip
                            label={session.status}
                            size="small"
                            color={getStatusColor(session.status)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box mt={1}>
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(session.startTime), 'MMM dd, yyyy')} • {format(new Date(session.startTime), 'h:mm a')} • RBT: {session.rbtName}
                          </Typography>
                          {session.notes && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {session.notes}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </Card>
        )}
      </Box>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="request session"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setAdditionalSessionDialog(true)}
      >
        <Add />
      </Fab>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (selectedSession) {
              setRescheduleDialog({ open: true, session: selectedSession });
            }
            handleMenuClose();
          }}
        >
          <Schedule sx={{ mr: 1 }} />
          Reschedule
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedSession) {
              setCancellationDialog({ open: true, session: selectedSession });
            }
            handleMenuClose();
          }}
        >
          <Cancel sx={{ mr: 1 }} />
          Cancel
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <SessionCancellationDialog
        open={cancellationDialog.open}
        session={cancellationDialog.session}
        onClose={() => setCancellationDialog({ open: false, session: null })}
        onConfirm={handleCancelSession}
      />

      <SessionRescheduleDialog
        open={rescheduleDialog.open}
        session={rescheduleDialog.session}
        onClose={() => setRescheduleDialog({ open: false, session: null })}
        onConfirm={handleRescheduleSession}
      />

      <AdditionalSessionRequestDialog
        open={additionalSessionDialog}
        child={child}
        onClose={() => setAdditionalSessionDialog(false)}
        onSubmit={handleAdditionalSessionRequest}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};