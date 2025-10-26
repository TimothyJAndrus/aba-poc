import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../test/utils';
import { SessionCard } from '../SessionCard';
import { mockSession } from '../../../test/utils';

describe('SessionCard Component', () => {
  const mockProps = {
    session: mockSession,
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onReschedule: vi.fn(),
  };

  it('displays session information correctly', () => {
    render(<SessionCard {...mockProps} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText(/10:00 AM - 11:00 AM/)).toBeInTheDocument();
  });

  it('shows correct status indicator', () => {
    render(<SessionCard {...mockProps} />);
    
    expect(screen.getByTestId('status-scheduled')).toBeInTheDocument();
  });

  it('handles different session statuses', () => {
    const completedSession = {
      ...mockSession,
      status: 'completed' as const,
    };

    render(<SessionCard {...mockProps} session={completedSession} />);
    expect(screen.getByTestId('status-completed')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<SessionCard {...mockProps} />);
    
    fireEvent.click(screen.getByTestId('edit-session-button'));
    expect(mockProps.onEdit).toHaveBeenCalledWith(mockSession);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<SessionCard {...mockProps} />);
    
    fireEvent.click(screen.getByTestId('cancel-session-button'));
    expect(mockProps.onCancel).toHaveBeenCalledWith(mockSession);
  });

  it('calls onReschedule when reschedule button is clicked', () => {
    render(<SessionCard {...mockProps} />);
    
    fireEvent.click(screen.getByTestId('reschedule-session-button'));
    expect(mockProps.onReschedule).toHaveBeenCalledWith(mockSession);
  });

  it('disables action buttons for completed sessions', () => {
    const completedSession = {
      ...mockSession,
      status: 'completed' as const,
    };

    render(<SessionCard {...mockProps} session={completedSession} />);
    
    expect(screen.getByTestId('edit-session-button')).toBeDisabled();
    expect(screen.getByTestId('cancel-session-button')).toBeDisabled();
  });

  it('shows session type indicator', () => {
    render(<SessionCard {...mockProps} />);
    
    expect(screen.getByTestId('session-type-therapy')).toBeInTheDocument();
  });
});