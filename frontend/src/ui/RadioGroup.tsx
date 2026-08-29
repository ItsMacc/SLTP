// src/ui/RadioGroup.tsx
import './RadioGroup.css';

export interface RadioOption {
  label: string;
  value: string | number;
  description?: string;
}

interface RadioGroupProps {
  label?: string;
  name: string;
  options: RadioOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  direction?: 'vertical' | 'horizontal';
}

export default function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  error,
  direction = 'vertical',
}: RadioGroupProps) {
  return (
    <div className="radio-group-wrapper">
      {label && <span className="radio-group-label">{label}</span>}
      <div className={`radio-options-container ${direction}`}>
        {options.map((option) => {
          const isChecked = value === option.value;
          return (
            <label
              key={option.value}
              className={`radio-option ${isChecked ? 'checked' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={() => onChange(option.value)}
                className="radio-native-input"
              />
              <span className="radio-custom-bullet" aria-hidden="true" />
              <div className="radio-text-content">
                <span className="radio-option-label">{option.label}</span>
                {option.description && (
                  <span className="radio-option-desc">{option.description}</span>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {error && <span className="radio-error-text">{error}</span>}
    </div>
  );
}