// src/ui/Checkbox.tsx
import React from 'react';
import './Checkbox.css';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export default function Checkbox({
  label,
  description,
  error,
  className = '',
  id,
  ...props
}: CheckboxProps) {
  const checkboxId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="checkbox-wrapper">
      <label htmlFor={checkboxId} className="checkbox-label-container">
        <input
          id={checkboxId}
          type="checkbox"
          className={`checkbox-input ${className}`}
          {...props}
        />
        <span className="checkbox-custom" aria-hidden="true">
          <svg className="checkbox-icon" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 5L4.5 8.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        <div className="checkbox-text-group">
          <span className="checkbox-label-text">{label}</span>
          {description && <span className="checkbox-description">{description}</span>}
        </div>
      </label>
      {error && <span className="checkbox-error-text">{error}</span>}
    </div>
  );
}