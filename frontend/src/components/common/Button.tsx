import React from 'react';
import {
  Button as MuiButton,
  CircularProgress,
  styled,
} from '@mui/material';
import type { ButtonProps as MuiButtonProps } from '@mui/material';
import { useId } from '../../hooks/useAccessibility';

// Define custom button variants
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface CustomButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  tooltip?: string;
}

// Styled button components for custom variants
const PrimaryButton = styled(MuiButton)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
  '&:disabled': {
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.grey[500],
  },
}));

const SecondaryButton = styled(MuiButton)(({ theme }) => ({
  backgroundColor: 'transparent',
  color: theme.palette.primary.main,
  border: `1px solid ${theme.palette.primary.main}`,
  '&:hover': {
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
    borderColor: theme.palette.primary.dark,
  },
  '&:disabled': {
    borderColor: theme.palette.grey[300],
    color: theme.palette.grey[500],
  },
}));

const GhostButton = styled(MuiButton)(({ theme }) => ({
  backgroundColor: 'transparent',
  color: theme.palette.primary.main,
  border: 'none',
  '&:hover': {
    backgroundColor: 'rgba(37, 99, 235, 0.04)',
  },
  '&:disabled': {
    color: theme.palette.grey[500],
  },
}));

export const Button: React.FC<CustomButtonProps> = ({
  variant = 'primary',
  loading = false,
  loadingText,
  children,
  disabled,
  ariaLabel,
  ariaDescribedBy,
  tooltip,
  ...props
}) => {
  const isDisabled = disabled || loading;
  const buttonId = useId('button');
  const loadingId = useId('loading');

  // Accessibility attributes
  const accessibilityProps = {
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy || (loading ? loadingId : undefined),
    'aria-disabled': isDisabled,
    'aria-busy': loading,
    title: tooltip,
    // Ensure minimum touch target size (44x44px)
    sx: {
      minHeight: '44px',
      minWidth: '44px',
      ...props.sx,
    },
  };

  const renderButton = () => {
    const buttonContent = loading ? (
      <>
        <CircularProgress
          size={16}
          sx={{
            marginRight: 1,
            color: 'inherit',
          }}
        />
        {loadingText || children}
      </>
    ) : (
      children
    );

    const commonProps = {
      ...props,
      ...accessibilityProps,
      id: buttonId,
      disabled: isDisabled,
      children: buttonContent,
    };

    switch (variant) {
      case 'secondary':
        return <SecondaryButton {...commonProps} />;
      case 'ghost':
        return <GhostButton {...commonProps} />;
      case 'primary':
      default:
        return <PrimaryButton {...commonProps} />;
    }
  };

  return renderButton();
};

export default Button;