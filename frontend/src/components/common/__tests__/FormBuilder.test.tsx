import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../test/utils';
import { FormBuilder } from '../FormBuilder';

describe('FormBuilder Component', () => {
  const mockFields = [
    {
      name: 'email',
      label: 'Email',
      type: 'email' as const,
      required: true,
      validation: {
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email',
      },
    },
    {
      name: 'name',
      label: 'Full Name',
      type: 'text' as const,
      required: true,
    },
    {
      name: 'role',
      label: 'Role',
      type: 'select' as const,
      options: [
        { value: 'admin', label: 'Administrator' },
        { value: 'employee', label: 'Employee' },
      ],
    },
  ];

  it('renders all form fields', () => {
    render(<FormBuilder fields={mockFields} onSubmit={vi.fn()} />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
  });

  it('shows validation errors for required fields', async () => {
    const onSubmit = vi.fn();
    render(<FormBuilder fields={mockFields} onSubmit={onSubmit} />);
    
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    });
    
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('validates email format', async () => {
    render(<FormBuilder fields={mockFields} onSubmit={vi.fn()} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn();
    render(<FormBuilder fields={mockFields} onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: 'John Doe' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'John Doe',
        role: '',
      });
    });
  });

  it('handles select field changes', () => {
    render(<FormBuilder fields={mockFields} onSubmit={vi.fn()} />);
    
    const selectField = screen.getByLabelText(/role/i);
    fireEvent.change(selectField, { target: { value: 'admin' } });
    
    expect(selectField).toHaveValue('admin');
  });
});