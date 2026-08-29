// src/ui/Input.tsx
import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({
  label,
  error,
  icon,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="input-wrapper">
      {label && <label htmlFor={inputId} className="input-label">{label}</label>}
      <div className={`input-container ${error ? 'has-error' : ''}`}>
        {icon && <span className="input-icon">{icon}</span>}
        <input
          id={inputId}
          className={`input-field ${icon ? 'has-icon' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}