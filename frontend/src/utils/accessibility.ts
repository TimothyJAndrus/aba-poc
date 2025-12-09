// Accessibility utilities and helpers for WCAG 2.1 AA compliance

type AriaPriority = 'polite' | 'assertive';
type NavigationOrientation = 'horizontal' | 'vertical' | 'both';
type NavigationDirection = 1 | -1;
type AriaCheckedState = boolean | 'mixed';

/**
 * Focus management utilities
 */
export class FocusManager {
  private readonly focusStack: HTMLElement[] = [];
  private trapElement: HTMLElement | null = null;
  private previousActiveElement: Element | null = null;

  /**
   * Trap focus within an element (for modals, dialogs)
   */
  trapFocus(element: HTMLElement) {
    this.previousActiveElement = document.activeElement;
    this.trapElement = element;

    const focusableElements = this.getFocusableElements(element);
    if (focusableElements.length === 0) return;

    // Focus first element
    focusableElements[0].focus();

    // Add event listener for tab navigation
    element.addEventListener('keydown', this.handleTrapKeydown);
  }

  /**
   * Release focus trap
   */
  releaseFocus() {
    if (this.trapElement) {
      this.trapElement.removeEventListener('keydown', this.handleTrapKeydown);
      this.trapElement = null;
    }

    // Restore focus to previous element
    if (this.previousActiveElement && 'focus' in this.previousActiveElement) {
      (this.previousActiveElement as HTMLElement).focus();
    }
    this.previousActiveElement = null;
  }

  /**
   * Handle keydown events for focus trap
   */
  private readonly handleTrapKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !this.trapElement) return;

    const focusableElements = this.getFocusableElements(this.trapElement);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else if (document.activeElement === lastElement) {
      // Tab
      event.preventDefault();
      firstElement.focus();
    }
  };

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    const elements = Array.from(container.querySelectorAll(focusableSelectors));

    return elements.filter(element => {
      const htmlElement = element as HTMLElement;
      return (
        htmlElement.offsetWidth > 0 &&
        htmlElement.offsetHeight > 0 &&
        !element.hasAttribute('hidden')
      );
    }) as HTMLElement[];
  }

  /**
   * Push focus to stack (for nested focus management)
   */
  pushFocus(element: HTMLElement) {
    if (document.activeElement instanceof HTMLElement) {
      this.focusStack.push(document.activeElement);
    }
    element.focus();
  }

  /**
   * Pop focus from stack
   */
  popFocus() {
    const element = this.focusStack.pop();
    if (element) {
      element.focus();
    }
  }

  /**
   * Move focus to next focusable element
   */
  focusNext(container?: HTMLElement) {
    const focusableElements = this.getFocusableElements(
      container || document.body
    );
    const currentIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement
    );
    const nextIndex = (currentIndex + 1) % focusableElements.length;
    focusableElements[nextIndex]?.focus();
  }

  /**
   * Move focus to previous focusable element
   */
  focusPrevious(container?: HTMLElement) {
    const focusableElements = this.getFocusableElements(
      container || document.body
    );
    const currentIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement
    );
    const prevIndex =
      currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
    focusableElements[prevIndex]?.focus();
  }
}

/**
 * Screen reader utilities
 */
export class ScreenReaderUtils {
  private announceElement: HTMLElement | null = null;

  constructor() {
    this.createAnnounceElement();
  }

  /**
   * Create hidden element for screen reader announcements
   */
  private createAnnounceElement() {
    this.announceElement = document.createElement('div');
    this.announceElement.setAttribute('aria-live', 'polite');
    this.announceElement.setAttribute('aria-atomic', 'true');
    this.announceElement.style.position = 'absolute';
    this.announceElement.style.left = '-10000px';
    this.announceElement.style.width = '1px';
    this.announceElement.style.height = '1px';
    this.announceElement.style.overflow = 'hidden';
    document.body.appendChild(this.announceElement);
  }

  /**
   * Announce message to screen readers
   */
  announce(message: string, priority: AriaPriority = 'polite') {
    if (!this.announceElement) return;

    this.announceElement.setAttribute('aria-live', priority);
    this.announceElement.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (this.announceElement) {
        this.announceElement.textContent = '';
      }
    }, 1000);
  }

  /**
   * Announce status change
   */
  announceStatus(status: string) {
    this.announce(`Status: ${status}`, 'polite');
  }

  /**
   * Announce error
   */
  announceError(error: string) {
    this.announce(`Error: ${error}`, 'assertive');
  }

  /**
   * Announce success
   */
  announceSuccess(message: string) {
    this.announce(`Success: ${message}`, 'polite');
  }
}

/**
 * Color contrast utilities
 */
export class ColorContrastUtils {
  /**
   * Calculate relative luminance of a color
   */
  static getRelativeLuminance(color: string): number {
    const rgb = this.hexToRgb(color);
    if (!rgb) return 0;

    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Calculate contrast ratio between two colors
   */
  static getContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getRelativeLuminance(color1);
    const lum2 = this.getRelativeLuminance(color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Check if color combination meets WCAG AA standards
   */
  static meetsWCAGAA(
    foreground: string,
    background: string,
    isLargeText = false
  ): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
  }

  /**
   * Check if color combination meets WCAG AAA standards
   */
  static meetsWCAGAAA(
    foreground: string,
    background: string,
    isLargeText = false
  ): boolean {
    const ratio = this.getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }

  /**
   * Convert hex color to RGB
   */
  private static hexToRgb(
    hex: string
  ): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : null;
  }

  /**
   * Get accessible color suggestions
   */
  static getAccessibleColor(
    targetColor: string,
    backgroundColor: string,
    isLargeText = false
  ): string {
    if (this.meetsWCAGAA(targetColor, backgroundColor, isLargeText)) {
      return targetColor;
    }

    // Try darkening or lightening the color
    const rgb = this.hexToRgb(targetColor);
    if (!rgb) return targetColor;

    // Try darker versions
    for (let factor = 0.9; factor > 0; factor -= 0.1) {
      const darkerColor = this.rgbToHex(
        Math.floor(rgb.r * factor),
        Math.floor(rgb.g * factor),
        Math.floor(rgb.b * factor)
      );
      if (this.meetsWCAGAA(darkerColor, backgroundColor, isLargeText)) {
        return darkerColor;
      }
    }

    // Try lighter versions
    for (let factor = 1.1; factor <= 2; factor += 0.1) {
      const lighterColor = this.rgbToHex(
        Math.min(255, Math.floor(rgb.r * factor)),
        Math.min(255, Math.floor(rgb.g * factor)),
        Math.min(255, Math.floor(rgb.b * factor))
      );
      if (this.meetsWCAGAA(lighterColor, backgroundColor, isLargeText)) {
        return lighterColor;
      }
    }

    // Fallback to high contrast colors
    const backgroundLum = this.getRelativeLuminance(backgroundColor);
    return backgroundLum > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Convert RGB to hex
   */
  private static rgbToHex(r: number, g: number, b: number): string {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
}

/**
 * Keyboard navigation utilities
 */
export class KeyboardNavigationUtils {
  /**
   * Handle arrow key navigation within a container
   */
  static handleArrowNavigation(
    event: KeyboardEvent,
    container: HTMLElement,
    options: {
      orientation?: NavigationOrientation;
      wrap?: boolean;
      itemSelector?: string;
    } = {}
  ) {
    const {
      orientation = 'both',
      wrap = true,
      itemSelector = '[role="option"], [role="menuitem"], [role="gridcell"], button, a',
    } = options;

    const items = Array.from(
      container.querySelectorAll<HTMLElement>(itemSelector)
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (currentIndex === -1) return;

    const nextIndex = this.getNextIndex(
      event,
      currentIndex,
      items.length,
      orientation,
      wrap
    );

    if (nextIndex !== currentIndex && items[nextIndex]) {
      items[nextIndex].focus();
    }
  }

  /**
   * Get next index based on keyboard event
   */
  private static getNextIndex(
    event: KeyboardEvent,
    currentIndex: number,
    itemCount: number,
    orientation: NavigationOrientation,
    wrap: boolean
  ): number {
    switch (event.key) {
      case 'ArrowDown':
        return this.handleVerticalNavigation(
          event,
          currentIndex,
          itemCount,
          orientation,
          wrap,
          1
        );
      case 'ArrowUp':
        return this.handleVerticalNavigation(
          event,
          currentIndex,
          itemCount,
          orientation,
          wrap,
          -1
        );
      case 'ArrowRight':
        return this.handleHorizontalNavigation(
          event,
          currentIndex,
          itemCount,
          orientation,
          wrap,
          1
        );
      case 'ArrowLeft':
        return this.handleHorizontalNavigation(
          event,
          currentIndex,
          itemCount,
          orientation,
          wrap,
          -1
        );
      case 'Home':
        event.preventDefault();
        return 0;
      case 'End':
        event.preventDefault();
        return itemCount - 1;
      default:
        return currentIndex;
    }
  }

  /**
   * Handle vertical navigation
   */
  private static handleVerticalNavigation(
    event: KeyboardEvent,
    currentIndex: number,
    itemCount: number,
    orientation: NavigationOrientation,
    wrap: boolean,
    direction: NavigationDirection
  ): number {
    if (orientation !== 'vertical' && orientation !== 'both') {
      return currentIndex;
    }

    event.preventDefault();
    return this.calculateNewIndex(currentIndex, itemCount, wrap, direction);
  }

  /**
   * Handle horizontal navigation
   */
  private static handleHorizontalNavigation(
    event: KeyboardEvent,
    currentIndex: number,
    itemCount: number,
    orientation: NavigationOrientation,
    wrap: boolean,
    direction: NavigationDirection
  ): number {
    if (orientation !== 'horizontal' && orientation !== 'both') {
      return currentIndex;
    }

    event.preventDefault();
    return this.calculateNewIndex(currentIndex, itemCount, wrap, direction);
  }

  /**
   * Calculate new index with wrap or boundary logic
   */
  private static calculateNewIndex(
    currentIndex: number,
    itemCount: number,
    wrap: boolean,
    direction: NavigationDirection
  ): number {
    if (direction === 1) {
      return wrap
        ? (currentIndex + 1) % itemCount
        : Math.min(currentIndex + 1, itemCount - 1);
    } else {
      return wrap
        ? (currentIndex - 1 + itemCount) % itemCount
        : Math.max(currentIndex - 1, 0);
    }
  }

  /**
   * Handle escape key to close modals/dropdowns
   */
  static handleEscape(event: KeyboardEvent, callback: () => void) {
    if (event.key === 'Escape') {
      event.preventDefault();
      callback();
    }
  }

  /**
   * Handle enter/space activation
   */
  static handleActivation(event: KeyboardEvent, callback: () => void) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }
}

/**
 * ARIA utilities
 */
export class AriaUtils {
  /**
   * Generate unique ID for ARIA relationships
   */
  static generateId(prefix = 'aria'): string {
    return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Set up ARIA describedby relationship
   */
  static setDescribedBy(element: HTMLElement, descriptionId: string) {
    const existingIds = element.getAttribute('aria-describedby') || '';
    const ids = existingIds.split(' ').filter(id => id.length > 0);

    if (!ids.includes(descriptionId)) {
      ids.push(descriptionId);
      element.setAttribute('aria-describedby', ids.join(' '));
    }
  }

  /**
   * Remove ARIA describedby relationship
   */
  static removeDescribedBy(element: HTMLElement, descriptionId: string) {
    const existingIds = element.getAttribute('aria-describedby') || '';
    const ids = existingIds.split(' ').filter(id => id !== descriptionId);

    if (ids.length > 0) {
      element.setAttribute('aria-describedby', ids.join(' '));
    } else {
      element.removeAttribute('aria-describedby');
    }
  }

  /**
   * Set up ARIA labelledby relationship
   */
  static setLabelledBy(element: HTMLElement, labelId: string) {
    element.setAttribute('aria-labelledby', labelId);
  }

  /**
   * Set ARIA expanded state
   */
  static setExpanded(element: HTMLElement, expanded: boolean) {
    element.setAttribute('aria-expanded', expanded.toString());
  }

  /**
   * Set ARIA selected state
   */
  static setSelected(element: HTMLElement, selected: boolean) {
    element.setAttribute('aria-selected', selected.toString());
  }

  /**
   * Set ARIA checked state
   */
  static setChecked(element: HTMLElement, checked: AriaCheckedState) {
    element.setAttribute('aria-checked', checked.toString());
  }

  /**
   * Set ARIA disabled state to true
   */
  static setAriaDisabled(element: HTMLElement) {
    element.setAttribute('aria-disabled', 'true');
  }

  /**
   * Remove ARIA disabled state
   */
  static removeAriaDisabled(element: HTMLElement) {
    element.removeAttribute('aria-disabled');
  }
}

// Global instances
export const globalFocusManager = new FocusManager();
export const globalScreenReader = new ScreenReaderUtils();

/**
 * React hooks for accessibility
 */
export const useAccessibility = () => {
  return {
    focusManager: globalFocusManager,
    screenReader: globalScreenReader,
    generateId: AriaUtils.generateId,
    announceToScreenReader:
      globalScreenReader.announce.bind(globalScreenReader),
  };
};
