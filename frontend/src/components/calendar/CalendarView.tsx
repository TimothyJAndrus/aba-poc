import React, { useState, useCallback, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Box,
  Paper,
  Toolbar,
  Typography,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  Add,
  ViewModule,
  ViewWeek,
  ViewDay,
} from '@mui/icons-material';
import { CalendarEvent } from '../../types';
import { useTheme } from '@mui/material/styles';

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onEventDrop?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onDateSelect?: (start: Date, end: Date) => void;
  onViewChange?: (view: string) => void;
  editable?: boolean;
  selectable?: boolean;
  initialView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  height?: string | number;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  onEventClick,
  onEventDrop,
  onDateSelect,
  onViewChange,
  editable = false,
  selectable = false,
  initialView = 'dayGridMonth',
  height = 'auto',
}) => {
  const theme = useTheme();
  const calendarRef = useRef<FullCalendar>(null);
  const [currentView, setCurrentView] = useState(initialView);
  const [conflictAlert, setConflictAlert] = useState<string | null>(null);

  // Convert CalendarEvent to FullCalendar event format
  const fullCalendarEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: theme.palette.getContrastText(event.color),
    editable: event.editable && editable,
    extendedProps: {
      type: event.type,
      status: event.status,
      participants: event.participants,
      originalEvent: event,
    },
  }));

  const handleEventClick = useCallback(
    (clickInfo: any) => {
      const originalEvent = clickInfo.event.extendedProps.originalEvent;
      if (onEventClick && originalEvent) {
        onEventClick(originalEvent);
      }
    },
    [onEventClick]
  );

  const handleEventDrop = useCallback(
    (dropInfo: any) => {
      const eventId = dropInfo.event.id;
      const newStart = dropInfo.event.start;
      const newEnd = dropInfo.event.end;

      // Check for conflicts
      const hasConflict = events.some(
        (event) =>
          event.id !== eventId &&
          event.type === 'session' &&
          ((newStart >= event.start && newStart < event.end) ||
            (newEnd > event.start && newEnd <= event.end) ||
            (newStart <= event.start && newEnd >= event.end))
      );

      if (hasConflict) {
        setConflictAlert('This time slot conflicts with another session. Please choose a different time.');
        dropInfo.revert();
        return;
      }

      if (onEventDrop) {
        onEventDrop(eventId, newStart, newEnd);
      }
    },
    [events, onEventDrop]
  );

  const handleDateSelect = useCallback(
    (selectInfo: any) => {
      if (onDateSelect) {
        onDateSelect(selectInfo.start, selectInfo.end);
      }
    },
    [onDateSelect]
  );

  const handleViewChange = useCallback(
    (view: string) => {
      setCurrentView(view as any);
      if (calendarRef.current) {
        calendarRef.current.getApi().changeView(view);
      }
      if (onViewChange) {
        onViewChange(view);
      }
    },
    [onViewChange]
  );

  const handleNavigation = useCallback((action: 'prev' | 'next' | 'today') => {
    if (calendarRef.current) {
      const api = calendarRef.current.getApi();
      switch (action) {
        case 'prev':
          api.prev();
          break;
        case 'next':
          api.next();
          break;
        case 'today':
          api.today();
          break;
      }
    }
  }, []);

  const getViewTitle = () => {
    if (calendarRef.current) {
      return calendarRef.current.getApi().view.title;
    }
    return '';
  };

  return (
    <Paper elevation={1} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Calendar Toolbar */}
      <Toolbar
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Previous">
            <IconButton onClick={() => handleNavigation('prev')} size="small">
              <ChevronLeft />
            </IconButton>
          </Tooltip>
          <Tooltip title="Today">
            <IconButton onClick={() => handleNavigation('today')} size="small">
              <Today />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next">
            <IconButton onClick={() => handleNavigation('next')} size="small">
              <ChevronRight />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" sx={{ ml: 2, minWidth: 200 }}>
            {getViewTitle()}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {selectable && (
            <Button
              variant="contained"
              startIcon={<Add />}
              size="small"
              sx={{ mr: 2 }}
            >
              Add Session
            </Button>
          )}
          
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Month View">
              <Button
                variant={currentView === 'dayGridMonth' ? 'contained' : 'outlined'}
                onClick={() => handleViewChange('dayGridMonth')}
              >
                <ViewModule />
              </Button>
            </Tooltip>
            <Tooltip title="Week View">
              <Button
                variant={currentView === 'timeGridWeek' ? 'contained' : 'outlined'}
                onClick={() => handleViewChange('timeGridWeek')}
              >
                <ViewWeek />
              </Button>
            </Tooltip>
            <Tooltip title="Day View">
              <Button
                variant={currentView === 'timeGridDay' ? 'contained' : 'outlined'}
                onClick={() => handleViewChange('timeGridDay')}
              >
                <ViewDay />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>
      </Toolbar>

      {/* Calendar Component */}
      <Box sx={{ flex: 1, p: 2 }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={currentView}
          headerToolbar={false} // We use custom toolbar
          events={fullCalendarEvents}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          select={handleDateSelect}
          selectable={selectable}
          editable={editable}
          droppable={editable}
          height={height}
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventDisplay="block"
          displayEventTime={true}
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
            startTime: '08:00',
            endTime: '18:00',
          }}
          weekends={true}
          nowIndicator={true}
          eventConstraint="businessHours"
          selectConstraint="businessHours"
          eventOverlap={false}
          selectOverlap={false}
          eventContent={(eventInfo) => {
            const { event } = eventInfo;
            const { type, status } = event.extendedProps;
            
            return (
              <Box
                sx={{
                  p: 0.5,
                  borderRadius: 1,
                  overflow: 'hidden',
                  height: '100%',
                  opacity: status === 'cancelled' ? 0.6 : 1,
                  textDecoration: status === 'cancelled' ? 'line-through' : 'none',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block' }}>
                  {event.title}
                </Typography>
                {type === 'session' && (
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.8 }}>
                    {eventInfo.timeText}
                  </Typography>
                )}
              </Box>
            );
          }}
          dayCellContent={(dayInfo) => {
            const isToday = dayInfo.isToday;
            return (
              <Box
                sx={{
                  fontWeight: isToday ? 'bold' : 'normal',
                  color: isToday ? 'primary.main' : 'inherit',
                }}
              >
                {dayInfo.dayNumberText}
              </Box>
            );
          }}
        />
      </Box>

      {/* Conflict Alert */}
      <Snackbar
        open={!!conflictAlert}
        autoHideDuration={6000}
        onClose={() => setConflictAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setConflictAlert(null)}
          severity="warning"
          sx={{ width: '100%' }}
        >
          {conflictAlert}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default CalendarView;