import { createTheme } from '@mui/material/styles';
import { ColorContrastUtils } from '../utils/accessibility';

// Declare module augmentation for custom typography variants
declare module '@mui/material/styles' {
  interface TypographyVariants {
    bodyLarge: React.CSSProperties;
    bodySmall: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    bodyLarge?: React.CSSProperties;
    bodySmall?: React.CSSProperties;
  }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    bodyLarge: true;
    bodySmall: true;
  }
}

// Validate color contrast ratios for accessibility
const validateColorContrast = () => {
  const colors = {
    primaryOnWhite: ColorContrastUtils.getContrastRatio('#2563eb', '#ffffff'),
    primaryOnGray50: ColorContrastUtils.getContrastRatio('#2563eb', '#f8fafc'),
    textPrimaryOnWhite: ColorContrastUtils.getContrastRatio('#334155', '#ffffff'),
    textSecondaryOnWhite: ColorContrastUtils.getContrastRatio('#64748b', '#ffffff'),
    errorOnWhite: ColorContrastUtils.getContrastRatio('#dc2626', '#ffffff'),
    successOnWhite: ColorContrastUtils.getContrastRatio('#059669', '#ffffff'),
  };

  // Log contrast ratios in development
  if (import.meta.env.DEV) {
    console.group('Color Contrast Validation (WCAG AA requires 4.5:1, AAA requires 7:1)');
    Object.entries(colors).forEach(([name, ratio]) => {
      const meetsAA = ratio >= 4.5;
      const meetsAAA = ratio >= 7;
      console.log(`${name}: ${ratio.toFixed(2)}:1 ${meetsAA ? '✓ AA' : '✗ AA'} ${meetsAAA ? '✓ AAA' : '✗ AAA'}`);
    });
    console.groupEnd();
  }

  return colors;
};

// Validate colors on theme creation
validateColorContrast();

// Define the comprehensive color palette and theme as specified in the design document
export const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb', // Primary Blue
      light: '#3b82f6', // Primary Blue Light
      dark: '#1d4ed8', // Primary Blue Dark
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0891b2', // Teal
      light: '#06b6d4', // Teal Light
      dark: '#0e7490', // Teal Dark
      contrastText: '#ffffff',
    },
    success: {
      main: '#059669', // Completed sessions, approvals
      light: '#10b981',
      dark: '#047857',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#d97706', // Pending items, conflicts
      light: '#f59e0b',
      dark: '#b45309',
      contrastText: '#ffffff',
    },
    error: {
      main: '#dc2626', // Cancellations, errors
      light: '#ef4444',
      dark: '#b91c1c',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0284c7', // Information, notifications
      light: '#0ea5e9',
      dark: '#0369a1',
      contrastText: '#ffffff',
    },
    grey: {
      50: '#f8fafc', // Background
      100: '#f1f5f9', // Card backgrounds
      200: '#e2e8f0', // Borders
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b', // Secondary text
      600: '#475569',
      700: '#334155', // Primary text
      800: '#1e293b',
      900: '#0f172a', // Headers
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#334155',
      secondary: '#64748b',
    },
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    // Page titles
    h1: {
      fontSize: '2.25rem', // 36px
      fontWeight: 600,
      lineHeight: 1.2,
      color: '#0f172a',
    },
    // Section headers
    h2: {
      fontSize: '1.875rem', // 30px
      fontWeight: 600,
      lineHeight: 1.3,
      color: '#0f172a',
    },
    // Subsection headers
    h3: {
      fontSize: '1.5rem', // 24px
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#334155',
    },
    // Card titles
    h4: {
      fontSize: '1.25rem', // 20px
      fontWeight: 600,
      lineHeight: 1.4,
      color: '#334155',
    },
    h5: {
      fontSize: '1.125rem', // 18px
      fontWeight: 500,
      lineHeight: 1.4,
      color: '#334155',
    },
    h6: {
      fontSize: '1rem', // 16px
      fontWeight: 500,
      lineHeight: 1.4,
      color: '#334155',
    },
    // Important text
    bodyLarge: {
      fontSize: '1.125rem', // 18px
      fontWeight: 400,
      lineHeight: 1.6,
      color: '#334155',
    },
    // Default text
    body1: {
      fontSize: '1rem', // 16px
      fontWeight: 400,
      lineHeight: 1.6,
      color: '#334155',
    },
    // Secondary text
    body2: {
      fontSize: '0.875rem', // 14px
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#64748b',
    },
    // Small text
    bodySmall: {
      fontSize: '0.875rem', // 14px
      fontWeight: 400,
      lineHeight: 1.5,
      color: '#64748b',
    },
    // Labels, captions
    caption: {
      fontSize: '0.75rem', // 12px
      fontWeight: 400,
      lineHeight: 1.4,
      color: '#64748b',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: '0.02em',
    },
    overline: {
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#64748b',
    },
  },
  spacing: 4, // Base unit: 4px (xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px, 3xl: 64px)
  shape: {
    borderRadius: 8,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },
  components: {
    // Button component defaults
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500,
          fontSize: '0.875rem',
          padding: '8px 16px',
          minHeight: 40,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          },
        },
        sizeSmall: {
          minHeight: 32,
          padding: '6px 12px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          minHeight: 48,
          padding: '12px 24px',
          fontSize: '0.9375rem',
        },
        containedPrimary: {
          backgroundColor: '#2563eb',
          '&:hover': {
            backgroundColor: '#1d4ed8',
          },
        },
        outlinedPrimary: {
          borderColor: '#2563eb',
          color: '#2563eb',
          '&:hover': {
            backgroundColor: 'rgba(37, 99, 235, 0.04)',
            borderColor: '#1d4ed8',
          },
        },
        textPrimary: {
          color: '#2563eb',
          '&:hover': {
            backgroundColor: 'rgba(37, 99, 235, 0.04)',
          },
        },
      },
    },
    // Card component defaults
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          },
        },
      },
    },
    // Form input defaults
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 6,
            '& fieldset': {
              borderColor: '#e2e8f0',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#2563eb',
              borderWidth: 2,
            },
            '&.Mui-error fieldset': {
              borderColor: '#dc2626',
            },
          },
          '& .MuiInputLabel-root': {
            color: '#64748b',
            '&.Mui-focused': {
              color: '#2563eb',
            },
            '&.Mui-error': {
              color: '#dc2626',
            },
          },
        },
      },
    },
    // Paper component defaults
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        },
        elevation3: {
          boxShadow: '0 10px 15px rgba(0,0,0,0.1)',
        },
      },
    },
    // Chip component defaults
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    // AppBar component defaults
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    // Drawer component defaults
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid #e2e8f0',
          boxShadow: 'none',
        },
      },
    },

    // Link accessibility
    MuiLink: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: '2px solid #2563eb',
            outlineOffset: '2px',
            borderRadius: '2px',
          },
        },
      },
    },
    // Menu accessibility
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: '44px', // Minimum touch target size
          '&:focus-visible': {
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            outline: '2px solid #2563eb',
            outlineOffset: '-2px',
          },
        },
      },
    },
    // Form control accessibility
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          marginLeft: 0,
          '& .MuiCheckbox-root, & .MuiRadio-root': {
            padding: '12px', // Larger touch target
          },
        },
      },
    },
    // Tab accessibility
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: '44px',
          '&:focus-visible': {
            outline: '2px solid #2563eb',
            outlineOffset: '-2px',
          },
        },
      },
    },
    // Icon button accessibility
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: '44px',
          minHeight: '44px',
          '&:focus-visible': {
            outline: '2px solid #2563eb',
            outlineOffset: '2px',
          },
        },
      },
    },
  },
});

// Accessibility helper functions
export const accessibilityHelpers = {
  // Get accessible color for given background
  getAccessibleColor: (color: string, background: string = '#ffffff', isLargeText = false) => {
    return ColorContrastUtils.getAccessibleColor(color, background, isLargeText);
  },
  
  // Check if color combination meets WCAG standards
  meetsWCAG: (foreground: string, background: string, level: 'AA' | 'AAA' = 'AA', isLargeText = false) => {
    return level === 'AA' 
      ? ColorContrastUtils.meetsWCAGAA(foreground, background, isLargeText)
      : ColorContrastUtils.meetsWCAGAAA(foreground, background, isLargeText);
  },
  
  // Get contrast ratio between colors
  getContrastRatio: ColorContrastUtils.getContrastRatio,
};
