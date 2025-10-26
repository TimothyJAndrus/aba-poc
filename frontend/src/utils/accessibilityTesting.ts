// Accessibility testing utilities for development and testing

import { ColorContrastUtils } from './accessibility';

/**
 * Accessibility audit utilities
 */
export class AccessibilityAuditor {
  private issues: AccessibilityIssue[] = [];

  /**
   * Run comprehensive accessibility audit
   */
  async audit(container: HTMLElement = document.body): Promise<AccessibilityAuditResult> {
    this.issues = [];

    // Run all audit checks
    this.auditColorContrast(container);
    this.auditKeyboardNavigation(container);
    this.auditAriaLabels(container);
    this.auditHeadingStructure(container);
    this.auditFormLabels(container);
    this.auditImages(container);
    this.auditLinks(container);
    this.auditFocusManagement(container);

    return {
      issues: this.issues,
      summary: this.generateSummary(),
    };
  }

  /**
   * Audit color contrast ratios
   */
  private auditColorContrast(container: HTMLElement) {
    const elements = container.querySelectorAll('*');
    
    elements.forEach((element) => {
      if (element instanceof HTMLElement) {
        const styles = window.getComputedStyle(element);
        const color = styles.color;
        const backgroundColor = styles.backgroundColor;
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = styles.fontWeight;
        
        // Skip elements with transparent or inherit colors
        if (color === 'rgba(0, 0, 0, 0)' || backgroundColor === 'rgba(0, 0, 0, 0)') {
          return;
        }

        // Determine if text is large (18pt+ or 14pt+ bold)
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
        
        try {
          const ratio = ColorContrastUtils.getContrastRatio(color, backgroundColor);
          const meetsAA = ColorContrastUtils.meetsWCAGAA(color, backgroundColor, isLargeText);
          
          if (!meetsAA) {
            this.addIssue({
              type: 'color-contrast',
              severity: 'error',
              element,
              message: `Insufficient color contrast ratio: ${ratio.toFixed(2)}:1 (requires ${isLargeText ? '3:1' : '4.5:1'})`,
              suggestion: `Use ${ColorContrastUtils.getAccessibleColor(color, backgroundColor, isLargeText)} instead`,
            });
          }
        } catch (error) {
          // Skip elements where contrast cannot be calculated
        }
      }
    });
  }

  /**
   * Audit keyboard navigation
   */
  private auditKeyboardNavigation(container: HTMLElement) {
    const interactiveElements = container.querySelectorAll(
      'button, a, input, select, textarea, [tabindex], [role="button"], [role="link"]'
    );

    interactiveElements.forEach((element) => {
      if (element instanceof HTMLElement) {
        const tabIndex = element.getAttribute('tabindex');
        
        // Check for positive tabindex (anti-pattern)
        if (tabIndex && parseInt(tabIndex) > 0) {
          this.addIssue({
            type: 'keyboard-navigation',
            severity: 'warning',
            element,
            message: 'Positive tabindex values can disrupt natural tab order',
            suggestion: 'Use tabindex="0" or remove tabindex to follow natural DOM order',
          });
        }

        // Check for missing focus indicators
        const styles = window.getComputedStyle(element, ':focus-visible');
        if (!styles.outline || styles.outline === 'none') {
          this.addIssue({
            type: 'keyboard-navigation',
            severity: 'error',
            element,
            message: 'Interactive element lacks visible focus indicator',
            suggestion: 'Add :focus-visible styles with clear outline or border',
          });
        }
      }
    });
  }

  /**
   * Audit ARIA labels and attributes
   */
  private auditAriaLabels(container: HTMLElement) {
    // Check for missing labels on form controls
    const formControls = container.querySelectorAll('input, select, textarea');
    formControls.forEach((element) => {
      if (element instanceof HTMLElement) {
        const hasLabel = element.getAttribute('aria-label') ||
                        element.getAttribute('aria-labelledby') ||
                        container.querySelector(`label[for="${element.id}"]`);
        
        if (!hasLabel) {
          this.addIssue({
            type: 'aria-labels',
            severity: 'error',
            element,
            message: 'Form control missing accessible label',
            suggestion: 'Add aria-label, aria-labelledby, or associate with a <label> element',
          });
        }
      }
    });

    // Check for invalid ARIA attributes
    const elementsWithAria = container.querySelectorAll('[aria-expanded], [aria-selected], [aria-checked]');
    elementsWithAria.forEach((element) => {
      const expanded = element.getAttribute('aria-expanded');
      const selected = element.getAttribute('aria-selected');
      const checked = element.getAttribute('aria-checked');

      if (expanded && !['true', 'false'].includes(expanded)) {
        this.addIssue({
          type: 'aria-labels',
          severity: 'error',
          element: element as HTMLElement,
          message: 'Invalid aria-expanded value',
          suggestion: 'Use "true" or "false" for aria-expanded',
        });
      }

      if (selected && !['true', 'false'].includes(selected)) {
        this.addIssue({
          type: 'aria-labels',
          severity: 'error',
          element: element as HTMLElement,
          message: 'Invalid aria-selected value',
          suggestion: 'Use "true" or "false" for aria-selected',
        });
      }

      if (checked && !['true', 'false', 'mixed'].includes(checked)) {
        this.addIssue({
          type: 'aria-labels',
          severity: 'error',
          element: element as HTMLElement,
          message: 'Invalid aria-checked value',
          suggestion: 'Use "true", "false", or "mixed" for aria-checked',
        });
      }
    });
  }

  /**
   * Audit heading structure
   */
  private auditHeadingStructure(container: HTMLElement) {
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let previousLevel = 0;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (level > previousLevel + 1) {
        this.addIssue({
          type: 'heading-structure',
          severity: 'warning',
          element: heading as HTMLElement,
          message: `Heading level skipped from h${previousLevel} to h${level}`,
          suggestion: 'Use sequential heading levels for proper document structure',
        });
      }

      previousLevel = level;
    });

    // Check for missing h1
    if (!container.querySelector('h1')) {
      this.addIssue({
        type: 'heading-structure',
        severity: 'warning',
        element: container,
        message: 'Page missing main heading (h1)',
        suggestion: 'Add an h1 element to identify the main page content',
      });
    }
  }

  /**
   * Audit form labels
   */
  private auditFormLabels(container: HTMLElement) {
    const labels = container.querySelectorAll('label');
    
    labels.forEach((label) => {
      const forAttr = label.getAttribute('for');
      if (forAttr) {
        const associatedInput = container.querySelector(`#${forAttr}`);
        if (!associatedInput) {
          this.addIssue({
            type: 'form-labels',
            severity: 'error',
            element: label as HTMLElement,
            message: 'Label references non-existent form control',
            suggestion: 'Ensure the "for" attribute matches an existing input ID',
          });
        }
      }
    });
  }

  /**
   * Audit images
   */
  private auditImages(container: HTMLElement) {
    const images = container.querySelectorAll('img');
    
    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const role = img.getAttribute('role');
      
      if (alt === null && role !== 'presentation') {
        this.addIssue({
          type: 'images',
          severity: 'error',
          element: img,
          message: 'Image missing alt attribute',
          suggestion: 'Add descriptive alt text or role="presentation" for decorative images',
        });
      }
    });
  }

  /**
   * Audit links
   */
  private auditLinks(container: HTMLElement) {
    const links = container.querySelectorAll('a');
    
    links.forEach((link) => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim();
      
      if (!href || href === '#') {
        this.addIssue({
          type: 'links',
          severity: 'warning',
          element: link,
          message: 'Link missing valid href attribute',
          suggestion: 'Provide a meaningful href or use a button element instead',
        });
      }

      if (!text || text.length < 2) {
        this.addIssue({
          type: 'links',
          severity: 'error',
          element: link,
          message: 'Link missing descriptive text',
          suggestion: 'Add descriptive link text or aria-label',
        });
      }

      // Check for generic link text
      const genericTexts = ['click here', 'read more', 'more', 'link'];
      if (text && genericTexts.includes(text.toLowerCase())) {
        this.addIssue({
          type: 'links',
          severity: 'warning',
          element: link,
          message: 'Link uses generic text',
          suggestion: 'Use descriptive link text that explains the destination or purpose',
        });
      }
    });
  }

  /**
   * Audit focus management
   */
  private auditFocusManagement(container: HTMLElement) {
    // Check for elements with negative tabindex that might trap focus
    const negativeTabIndex = container.querySelectorAll('[tabindex="-1"]');
    
    negativeTabIndex.forEach((element) => {
      // This is often intentional, so just log as info
      if (element instanceof HTMLElement && element.offsetParent !== null) {
        this.addIssue({
          type: 'focus-management',
          severity: 'info',
          element,
          message: 'Element removed from tab order with tabindex="-1"',
          suggestion: 'Ensure this is intentional and element is still accessible via other means',
        });
      }
    });
  }

  /**
   * Add an accessibility issue
   */
  private addIssue(issue: AccessibilityIssue) {
    this.issues.push(issue);
  }

  /**
   * Generate audit summary
   */
  private generateSummary(): AccessibilityAuditSummary {
    const summary = {
      total: this.issues.length,
      errors: this.issues.filter(i => i.severity === 'error').length,
      warnings: this.issues.filter(i => i.severity === 'warning').length,
      info: this.issues.filter(i => i.severity === 'info').length,
      byType: {} as Record<string, number>,
    };

    this.issues.forEach(issue => {
      summary.byType[issue.type] = (summary.byType[issue.type] || 0) + 1;
    });

    return summary;
  }
}

/**
 * Types for accessibility audit
 */
export interface AccessibilityIssue {
  type: 'color-contrast' | 'keyboard-navigation' | 'aria-labels' | 'heading-structure' | 
        'form-labels' | 'images' | 'links' | 'focus-management';
  severity: 'error' | 'warning' | 'info';
  element: HTMLElement;
  message: string;
  suggestion: string;
}

export interface AccessibilityAuditSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  byType: Record<string, number>;
}

export interface AccessibilityAuditResult {
  issues: AccessibilityIssue[];
  summary: AccessibilityAuditSummary;
}

/**
 * Development helper to run accessibility audit
 */
export const runAccessibilityAudit = async (container?: HTMLElement): Promise<void> => {
  if (import.meta.env.PROD) {
    return;
  }

  const auditor = new AccessibilityAuditor();
  const result = await auditor.audit(container);

  console.group('🔍 Accessibility Audit Results');
  console.log(`Total issues: ${result.summary.total}`);
  console.log(`Errors: ${result.summary.errors}`);
  console.log(`Warnings: ${result.summary.warnings}`);
  console.log(`Info: ${result.summary.info}`);
  
  if (result.issues.length > 0) {
    console.group('Issues by type:');
    Object.entries(result.summary.byType).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    console.groupEnd();

    console.group('Detailed issues:');
    result.issues.forEach((issue) => {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.group(`${icon} ${issue.type} (${issue.severity})`);
      console.log('Message:', issue.message);
      console.log('Suggestion:', issue.suggestion);
      console.log('Element:', issue.element);
      console.groupEnd();
    });
    console.groupEnd();
  } else {
    console.log('✅ No accessibility issues found!');
  }
  
  console.groupEnd();
};

/**
 * Global accessibility auditor instance
 */
export const globalAccessibilityAuditor = new AccessibilityAuditor();

// Auto-run audit in development when DOM is ready
if (import.meta.env.DEV) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => runAccessibilityAudit(), 1000);
    });
  } else {
    setTimeout(() => runAccessibilityAudit(), 1000);
  }
}