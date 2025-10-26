import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  IconButton,
  Button,
  ButtonGroup,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
  CalendarMonth,
  ViewWeek,
  ViewDay,
} from '@mui/icons-material';
import type { CalendarEvent } from '../../types';

interface PersonalScheduleCalendarProps {
  events: CalendarEvent[];
  loading?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}

type ViewMode = 'month' | 'week' | 'day';

const getEventColor = (event: CalendarEvent) => {
  switch (event.status) {
    case 'scheduled':
      return '#2563eb';
    case 'completed':
      return '#059669';
    case 'cancelled':
      return '#dc2626';
    case 'rescheduled':
      return '#d97706';
    default:
      return '#64748b';
  }
};

const formatEventTime = (start: Date, end: Date) => {
  const startTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(start);
  
  const endTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(end);
  
  return `${startTime} - ${endTime}`;
};

export const PersonalScheduleCalendar: React.FC<PersonalScheduleCalendarProps> = ({
  events,
  loading = false,
  onEventClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    
    switch (viewMode) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeText = () => {
    switch (viewMode) {
      case 'month':
        return new Intl.DateTimeFormat('en-US', {
          month: 'long',
          year: 'numeric',
        }).format(currentDate);
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        return `${new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
        }).format(weekStart)} - ${new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(weekEnd)}`;
      case 'day':
        return new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }).format(currentDate);
    }
  };

  const getEventsForView = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (viewMode) {
      case 'month':
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return events.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate >= monthStart && eventDate <= monthEnd;
        });
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return events.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate >= weekStart && eventDate <= weekEnd;
        });
      case 'day':
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        return events.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate >= dayStart && eventDate <= dayEnd;
        });
    }
  };

  const renderWeekView = () => {
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      return day;
    });

    const viewEvents = getEventsForView();

    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, mt: 2 }}>
        {days.map((day, index) => {
          const dayEvents = viewEvents.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.toDateString() === day.toDateString();
          });

          const isToday = day.toDateString() === new Date().toDateString();

          return (
            <Box
              key={index}
              sx={{
                minHeight: 120,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                bgcolor: isToday ? 'primary.50' : 'background.paper',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: isToday ? 600 : 400,
                  color: isToday ? 'primary.main' : 'text.secondary',
                }}
              >
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: isToday ? 600 : 400,
                  color: isToday ? 'primary.main' : 'text.primary',
                  mb: 1,
                }}
              >
                {day.getDate()}
              </Typography>
              
              {dayEvents.map((event) => (
                <Tooltip
                  key={event.id}
                  title={`${event.title} - ${formatEventTime(event.start, event.end)}`}
                >
                  <Box
                    sx={{
                      bgcolor: getEventColor(event),
                      color: 'white',
                      p: 0.5,
                      mb: 0.5,
                      borderRadius: 0.5,
                      fontSize: '0.75rem',
                      cursor: onEventClick ? 'pointer' : 'default',
                      '&:hover': onEventClick ? {
                        opacity: 0.8,
                      } : {},
                    }}
                    onClick={() => onEventClick?.(event)}
                  >
                    <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 500 }}>
                      {event.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'inherit', display: 'block' }}>
                      {formatEventTime(event.start, event.end)}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderDayView = () => {
    const viewEvents = getEventsForView().sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    if (viewEvents.length === 0) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CalendarMonth sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            No sessions scheduled for this day
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        {viewEvents.map((event) => (
          <Card
            key={event.id}
            variant="outlined"
            sx={{
              mb: 1,
              cursor: onEventClick ? 'pointer' : 'default',
              '&:hover': onEventClick ? {
                boxShadow: 1,
              } : {},
            }}
            onClick={() => onEventClick?.(event)}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {event.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatEventTime(event.start, event.end)}
                  </Typography>
                  {event.participants.client && (
                    <Typography variant="caption" color="text.secondary">
                      Client: {event.participants.client.name}
                    </Typography>
                  )}
                </Box>
                <Chip
                  label={event.status}
                  size="small"
                  sx={{
                    bgcolor: getEventColor(event),
                    color: 'white',
                    '& .MuiChip-label': { color: 'white' },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Personal Schedule" />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Loading schedule...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Personal Schedule"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <ButtonGroup size="small" variant="outlined">
              <Button
                variant={viewMode === 'month' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('month')}
                startIcon={<CalendarMonth />}
              >
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('week')}
                startIcon={<ViewWeek />}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'day' ? 'contained' : 'outlined'}
                onClick={() => setViewMode('day')}
                startIcon={<ViewDay />}
              >
                Day
              </Button>
            </ButtonGroup>
          </Box>
        }
      />
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={() => navigateDate('prev')}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
              {getDateRangeText()}
            </Typography>
            <IconButton onClick={() => navigateDate('next')}>
              <ChevronRight />
            </IconButton>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Today />}
            onClick={goToToday}
          >
            Today
          </Button>
        </Box>

        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'month' && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Month view coming soon. Please use Week or Day view for now.
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalScheduleCalendar;