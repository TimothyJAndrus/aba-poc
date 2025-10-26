import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  Button,
  Typography,
  Divider,
  styled,
  Alert,
} from '@mui/material';
import { 
  useId, 
  useFormAccessibility, 
  useLiveRegion,
  useScreenReader 
} from '../../hooks/useAccessibility';
// Date picker imports will be added when needed
// import { DatePicker } from '@mui/x-date-pickers/DatePicker';
// import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
// import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

export interface FormField {
  id: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'radio' | 'date' | 'textarea';
  label: string;
  placeholder?: string;
  options?: { value: string | number; label: string }[];
  validation?: ValidationRule;
  defaultValue?: any;
  disabled?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  multiline?: boolean;
  rows?: number;
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormBuilderProps {
  fields?: FormField[];
  steps?: FormStep[];
  onSubmit: (data: Record<string, any>) => void | Promise<void>;
  onFieldChange?: (fieldId: string, value: any) => void;
  submitLabel?: string;
  loading?: boolean;
  initialValues?: Record<string, any>;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

const StyledForm = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const StepContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.grey[200]}`,
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(2),
}));

const FieldContainer = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export const FormBuilder: React.FC<FormBuilderProps> = ({
  fields = [],
  steps = [],
  onSubmit,
  onFieldChange,
  submitLabel = 'Submit',
  loading = false,
  initialValues = {},
  autoSave = false,
  autoSaveDelay = 1000,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<number | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Accessibility hooks
  const formId = useId('form');
  const { announceValidationError, announceFormSubmission } = useFormAccessibility();
  const { message: liveMessage, announce: announceLive, liveRegionProps } = useLiveRegion();
  const { announceError } = useScreenReader();

  const isMultiStep = steps.length > 0;
  const currentFields = isMultiStep ? steps[currentStep]?.fields || [] : fields;
  const totalSteps = steps.length;

  const validateField = useCallback((field: FormField, value: any): string | null => {
    const { validation } = field;
    if (!validation) return null;

    if (validation.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return `${field.label} is required`;
    }

    if (validation.minLength && typeof value === 'string' && value.length < validation.minLength) {
      return `${field.label} must be at least ${validation.minLength} characters`;
    }

    if (validation.maxLength && typeof value === 'string' && value.length > validation.maxLength) {
      return `${field.label} must be no more than ${validation.maxLength} characters`;
    }

    if (validation.pattern && typeof value === 'string' && !validation.pattern.test(value)) {
      return `${field.label} format is invalid`;
    }

    if (validation.custom) {
      return validation.custom(value);
    }

    return null;
  }, []);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    const newFormData = { ...formData, [fieldId]: value };
    setFormData(newFormData);

    // Clear error for this field
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }

    // Validate field
    const field = currentFields.find(f => f.id === fieldId);
    if (field) {
      const error = validateField(field, value);
      if (error) {
        setErrors(prev => ({ ...prev, [fieldId]: error }));
        // Announce validation error to screen readers
        if (submitAttempted) {
          announceValidationError(field.label, error);
        }
      }
    }

    // Call external change handler
    onFieldChange?.(fieldId, value);

    // Auto-save functionality
    if (autoSave) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      const timeout = setTimeout(() => {
        announceLive('Form auto-saved');
        console.log('Auto-saving form data:', newFormData);
      }, autoSaveDelay);
      setAutoSaveTimeout(timeout);
    }
  }, [formData, errors, currentFields, validateField, onFieldChange, autoSave, autoSaveDelay, autoSaveTimeout, submitAttempted, announceValidationError, announceLive]);

  const validateStep = useCallback((stepFields: FormField[]): boolean => {
    const stepErrors: Record<string, string> = {};
    let isValid = true;
    const errorMessages: string[] = [];

    stepFields.forEach(field => {
      const error = validateField(field, formData[field.id]);
      if (error) {
        stepErrors[field.id] = error;
        errorMessages.push(`${field.label}: ${error}`);
        isValid = false;
      }
    });

    setErrors(prev => ({ ...prev, ...stepErrors }));
    
    // Announce validation errors
    if (!isValid && errorMessages.length > 0) {
      const errorSummary = `Form has ${errorMessages.length} error${errorMessages.length > 1 ? 's' : ''}: ${errorMessages.join(', ')}`;
      announceError(errorSummary);
      announceLive(errorSummary);
    }
    
    return isValid;
  }, [formData, validateField, announceError, announceLive]);

  const handleNextStep = () => {
    setSubmitAttempted(true);
    if (validateStep(currentFields)) {
      const nextStep = Math.min(currentStep + 1, totalSteps - 1);
      setCurrentStep(nextStep);
      announceLive(`Moved to step ${nextStep + 1} of ${totalSteps}: ${steps[nextStep]?.title}`);
    }
  };

  const handlePrevStep = () => {
    const prevStep = Math.max(currentStep - 1, 0);
    setCurrentStep(prevStep);
    announceLive(`Moved to step ${prevStep + 1} of ${totalSteps}: ${steps[prevStep]?.title}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    
    const allFields = isMultiStep ? steps.flatMap(step => step.fields) : fields;
    if (validateStep(allFields)) {
      try {
        await onSubmit(formData);
        announceFormSubmission(true, 'Form submitted successfully');
      } catch (error) {
        console.error('Form submission error:', error);
        announceFormSubmission(false, 'Form submission failed. Please try again.');
      }
    }
  };

  const renderField = (field: FormField) => {
    const value = formData[field.id] || field.defaultValue || '';
    const error = errors[field.id];
    const hasError = Boolean(error);
    const fieldId = useId(`field-${field.id}`);
    const errorId = useId(`error-${field.id}`);
    const helperId = useId(`helper-${field.id}`);

    const commonProps = {
      id: fieldId,
      label: field.label,
      error: hasError,
      helperText: error || field.helperText,
      disabled: field.disabled || loading,
      fullWidth: field.fullWidth !== false,
      size: field.size || 'medium',
      required: field.validation?.required,
      'aria-describedby': hasError ? errorId : (field.helperText ? helperId : undefined),
      'aria-invalid': hasError,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'number':
        return (
          <TextField
            {...commonProps}
            type={field.type}
            value={value}
            placeholder={field.placeholder}
            multiline={field.multiline}
            rows={field.rows}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );

      case 'textarea':
        return (
          <TextField
            {...commonProps}
            multiline
            rows={field.rows || 4}
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        );

      case 'select':
        return (
          <FormControl {...commonProps}>
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value}
              label={field.label}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
            >
              {field.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {(error || field.helperText) && (
              <FormHelperText error={hasError}>
                {error || field.helperText}
              </FormHelperText>
            )}
          </FormControl>
        );

      case 'checkbox':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={Boolean(value)}
                onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                disabled={field.disabled || loading}
              />
            }
            label={field.label}
          />
        );

      case 'radio':
        return (
          <FormControl component="fieldset" error={hasError}>
            <Typography 
              variant="body2" 
              component="legend" 
              gutterBottom
              id={`${fieldId}-legend`}
            >
              {field.label}
              {field.validation?.required && (
                <span aria-label="required" style={{ color: 'red', marginLeft: 4 }}>*</span>
              )}
            </Typography>
            <RadioGroup
              value={value}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              aria-labelledby={`${fieldId}-legend`}
              aria-describedby={hasError ? errorId : (field.helperText ? helperId : undefined)}
            >
              {field.options?.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio />}
                  label={option.label}
                  disabled={field.disabled || loading}
                />
              ))}
            </RadioGroup>
            {(error || field.helperText) && (
              <FormHelperText id={hasError ? errorId : helperId}>
                {error || field.helperText}
              </FormHelperText>
            )}
          </FormControl>
        );

      case 'date':
        return (
          <TextField
            {...commonProps}
            type="date"
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
          />
        );

      default:
        return null;
    }
  };

  const renderStep = (step: FormStep, index: number) => (
    <StepContainer key={step.id}>
      <Typography variant="h6" gutterBottom>
        Step {index + 1}: {step.title}
      </Typography>
      {step.description && (
        <Typography variant="body2" color="text.secondary" paragraph>
          {step.description}
        </Typography>
      )}
      <Divider sx={{ mb: 3 }} />
      {step.fields.map((field) => (
        <FieldContainer key={field.id}>
          {renderField(field)}
        </FieldContainer>
      ))}
    </StepContainer>
  );

  // Error summary for accessibility
  const errorCount = Object.keys(errors).length;
  const hasErrors = errorCount > 0 && submitAttempted;

  return (
    <StyledForm onSubmit={handleSubmit} noValidate id={formId} role="form">
      {/* Live region for announcements */}
      <div {...liveRegionProps}>
        {liveMessage}
      </div>
      
      {/* Error summary */}
      {hasErrors && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          role="alert"
          aria-live="assertive"
        >
          <Typography variant="h6" component="h2" gutterBottom>
            Form has {errorCount} error{errorCount > 1 ? 's' : ''}
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            {Object.entries(errors).map(([fieldId, error]) => {
              const field = [...fields, ...steps.flatMap(s => s.fields)].find(f => f.id === fieldId);
              return (
                <li key={fieldId}>
                  <a 
                    href={`#field-${fieldId}`}
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(`field-${fieldId}`)?.focus();
                    }}
                  >
                    {field?.label}: {error}
                  </a>
                </li>
              );
            })}
          </ul>
        </Alert>
      )}

      {isMultiStep ? (
        <>
          {renderStep(steps[currentStep], currentStep)}
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button
              onClick={handlePrevStep}
              disabled={currentStep === 0 || loading}
              variant="outlined"
            >
              Previous
            </Button>
            
            {currentStep === totalSteps - 1 ? (
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
              >
                {submitLabel}
              </Button>
            ) : (
              <Button
                onClick={handleNextStep}
                variant="contained"
                disabled={loading}
              >
                Next
              </Button>
            )}
          </Box>
        </>
      ) : (
        <>
          {fields.map((field) => (
            <FieldContainer key={field.id}>
              {renderField(field)}
            </FieldContainer>
          ))}
          
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ alignSelf: 'flex-start' }}
          >
            {submitLabel}
          </Button>
        </>
      )}
    </StyledForm>
  );
};

export default FormBuilder;