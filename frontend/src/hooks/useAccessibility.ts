// React hooks for accessibility features

import { useEffect, useRef, useCallback, useState } from 'react';
import { 
  globalFocusManager, 
  globalScreenReader, 
  AriaUtils, 
  KeyboardNavigation 
} from '../utils/accessibility';

/**
 * Hook for managing focus traps (modals, dialogs)
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      globalFocusManager.trapFocus(containerRef.current);
      return () => globalFocusManager.releaseFocus();
    }
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore() {
  const previousActiveElement = useRef<Element | null>(null);

  const saveFocus = useCallback(() => {
    previousActiveElement.current = document.activeElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousActiveElement.current && 'focus' in previousActiveElement.current) {
      (previousActiveElement.current as HTMLElement).focus();
    }
  }, []);

  return { saveFocus, restoreFocus };
}

/**
 * Hook for screen reader announcements
 */
export function useScreenReader() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    globalScreenReader.announce(message, priority);
  }, []);

  const announceStatus = useCallback((status: string) => {
    globalScreenReader.announceStatus(status);
  }, []);

  const announceError = useCallback((error: string) => {
    globalScreenReader.announceError(error);
  }, []);

  const announceSuccess = useCallback((message: string) => {
    globalScreenReader.announceSuccess(message);
  }, []);

  return {
    announce,
    announceStatus,
    announceError,
    announceSuccess,
  };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation(
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    wrap?: boolean;
    itemSelector?: string;
  } = {}
) {
  const containerRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (containerRef.current) {
      KeyboardNavigation.handleArrowNavigation(event, containerRef.current, options);
    }
  }, [options]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  return containerRef;
}

/**
 * Hook for managing ARIA attributes
 */
export function useAriaAttributes() {
  const [ariaAttributes, setAriaAttributes] = useState<Record<string, string>>({});

  const setExpanded = useCallback((expanded: boolean) => {
    setAriaAttributes(prev => ({ ...prev, 'aria-expanded': expanded.toString() }));
  }, []);

  const setSelected = useCallback((selected: boolean) => {
    setAriaAttributes(prev => ({ ...prev, 'aria-selected': selected.toString() }));
  }, []);

  const setChecked = useCallback((checked: boolean | 'mixed') => {
    setAriaAttributes(prev => ({ ...prev, 'aria-checked': checked.toString() }));
  }, []);

  const setDisabled = useCallback((disabled: boolean) => {
    setAriaAttributes(prev => {
      const newAttrs = { ...prev };
      if (disabled) {
        newAttrs['aria-disabled'] = 'true';
      } else {
        delete newAttrs['aria-disabled'];
      }
      return newAttrs;
    });
  }, []);

  const setDescribedBy = useCallback((ids: string | string[]) => {
    const idString = Array.isArray(ids) ? ids.join(' ') : ids;
    setAriaAttributes(prev => ({ ...prev, 'aria-describedby': idString }));
  }, []);

  const setLabelledBy = useCallback((id: string) => {
    setAriaAttributes(prev => ({ ...prev, 'aria-labelledby': id }));
  }, []);

  return {
    ariaAttributes,
    setExpanded,
    setSelected,
    setChecked,
    setDisabled,
    setDescribedBy,
    setLabelledBy,
  };
}

/**
 * Hook for generating unique IDs
 */
export function useId(prefix = 'id') {
  const id = useRef<string>('');
  
  if (!id.current) {
    id.current = AriaUtils.generateId(prefix);
  }
  
  return id.current;
}

/**
 * Hook for managing modal accessibility
 */
export function useModal(isOpen: boolean) {
  const modalRef = useFocusTrap(isOpen);
  const { saveFocus, restoreFocus } = useFocusRestore();
  const { announce } = useScreenReader();

  useEffect(() => {
    if (isOpen) {
      saveFocus();
      announce('Modal opened');
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
        restoreFocus();
        announce('Modal closed');
      };
    }
  }, [isOpen, saveFocus, restoreFocus, announce]);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      // This should be handled by the parent component
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleEscape]);

  return {
    modalRef,
    handleEscape,
  };
}

/**
 * Hook for managing dropdown accessibility
 */
export function useDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const { announce } = useScreenReader();

  const open = useCallback(() => {
    setIsOpen(true);
    announce('Menu opened');
  }, [announce]);

  const close = useCallback(() => {
    setIsOpen(false);
    announce('Menu closed');
    triggerRef.current?.focus();
  }, [announce]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          close();
          break;
        case 'ArrowDown':
        case 'ArrowUp':
          event.preventDefault();
          KeyboardNavigation.handleArrowNavigation(event, menuRef.current!, {
            orientation: 'vertical',
            wrap: true,
          });
          break;
        case 'Home':
        case 'End':
          event.preventDefault();
          KeyboardNavigation.handleArrowNavigation(event, menuRef.current!, {
            orientation: 'vertical',
          });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current && 
        triggerRef.current &&
        !menuRef.current.contains(target) &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  return {
    isOpen,
    open,
    close,
    toggle,
    triggerRef,
    menuRef,
    triggerProps: {
      'aria-expanded': isOpen,
      'aria-haspopup': 'true' as const,
    },
    menuProps: {
      role: 'menu' as const,
      'aria-hidden': !isOpen,
    },
  };
}

/**
 * Hook for managing form accessibility
 */
export function useFormAccessibility() {
  const { announceError, announceSuccess } = useScreenReader();

  const announceValidationError = useCallback((fieldName: string, error: string) => {
    announceError(`${fieldName}: ${error}`);
  }, [announceError]);

  const announceFormSubmission = useCallback((success: boolean, message?: string) => {
    if (success) {
      announceSuccess(message || 'Form submitted successfully');
    } else {
      announceError(message || 'Form submission failed');
    }
  }, [announceSuccess, announceError]);

  return {
    announceValidationError,
    announceFormSubmission,
  };
}

/**
 * Hook for managing live regions
 */
export function useLiveRegion(initialMessage = '') {
  const [message, setMessage] = useState(initialMessage);
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback((newMessage: string, priority: 'polite' | 'assertive' = 'polite') => {
    setPoliteness(priority);
    setMessage(newMessage);
    
    // Clear message after announcement
    setTimeout(() => setMessage(''), 1000);
  }, []);

  return {
    message,
    politeness,
    announce,
    liveRegionProps: {
      'aria-live': politeness,
      'aria-atomic': true,
      style: {
        position: 'absolute' as const,
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden' as const,
      },
    },
  };
}