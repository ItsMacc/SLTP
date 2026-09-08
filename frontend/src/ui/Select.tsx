import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from 'react';
import './Select.css';

export interface SelectOption {
  label: string;
  value: string | number;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  placeholder?: string;
}

export default function Select({
  label,
  options,
  value,
  onChange,
  error,
  placeholder = 'Select option...',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Position the dropdown with fixed positioning so it is never clipped by
  // scroll containers (e.g. the horizontally scrollable strategy controls bar).
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownStyle(null);
      return;
    }
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = Math.min(240, options.length * 40 + 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= menuHeight + 12
        ? rect.bottom + 6
        : Math.max(8, rect.top - menuHeight - 6);
    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      top,
      width: rect.width,
    });
  }, [isOpen, options.length]);

  // Close the dropdown if the page or any scroll container scrolls while open.
  useEffect(() => {
    if (!isOpen) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && containerRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  return (
    <div className="select-wrapper" ref={containerRef}>
      {label && <span className="select-label">{label}</span>}
      <div className={`select-container ${error ? 'has-error' : ''} ${isOpen ? 'is-open' : ''}`}>
        
        <button
          ref={triggerRef}
          type="button"
          className="select-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <span className={`select-value-text ${!selectedOption ? 'placeholder' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <span className={`select-chevron ${isOpen ? 'rotated' : ''}`} aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </button>

        {isOpen && dropdownStyle && (
          <div className="select-dropdown-menu" style={dropdownStyle}>
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`select-option-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <svg className="select-check-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 6L4.5 8.5L10 3" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {error && <span className="select-error-text">{error}</span>}
    </div>
  );
}