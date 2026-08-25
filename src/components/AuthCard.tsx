import React, { useState } from 'react';
import { loginSchema, signUpSchema } from '../../lib/authSchema';
import { supabase } from '../../lib/supabase';
import './AuthCard.css';

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
  onClose?: () => void;
  onSuccess?: (user: { name: string; email: string }) => void;
}

export const AuthCard: React.FC<AuthCardProps> = ({ 
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) {
      setErrors((prev) => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setConfirmationSent(false);

    // 1. Zod Form Validation
    if (mode === 'login') {
      const result = loginSchema.safeParse({
        email: formData.email,
        password: formData.password,
      });

      if (!result.success) {
        const formatted: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const fieldName = issue.path[0]?.toString() || 'email';
          formatted[fieldName] = issue.message;
        });
        setErrors(formatted);
        return;
      }
    } else {
      const result = signUpSchema.safeParse(formData);

      if (!result.success) {
        const formatted: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
          const fieldName = issue.path[0]?.toString() || 'email';
          formatted[fieldName] = issue.message;
        });
        setErrors(formatted);
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        // 2. Supabase Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (error) {
          setErrors({ email: error.message });
          return;
        }

        // With Email Confirmation ON, session is null until verified
        if (data.user && !data.session) {
          setConfirmationSent(true);
        } else if (data.user && data.session) {
          onSuccess?.({
            name: formData.fullName,
            email: data.user.email || formData.email,
          });
        }
      } else {
        // 3. Supabase Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            setErrors({ email: 'Please confirm your email address before signing in.' });
          } else {
            setErrors({ email: 'Invalid email address or password.' });
          }
          return;
        }

        if (data.user) {
          onSuccess?.({
            name: data.user.user_metadata?.full_name || 'User',
            email: data.user.email || formData.email,
          });
        }
      }
    } catch (err) {
      setErrors({ email: 'Authentication failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="st-auth">
      <div className="st-auth__card">
        {onClose && (
          <button
            type="button"
            className="st-auth__close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        )}

        <div className="st-auth__tabs">
          <button
            type="button"
            className={`st-auth__tab ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrors({});
              setConfirmationSent(false);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`st-auth__tab ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('signup');
              setErrors({});
              setConfirmationSent(false);
            }}
          >
            Create Account
          </button>
        </div>

        <h2 className="st-auth__title">
          {mode === 'login' ? 'Welcome back' : 'Get started'}
        </h2>
        <p className="st-auth__subtitle">
          {mode === 'login'
            ? 'Enter your credentials to access your account'
            : 'Create an account to start tracking your portfolio'}
        </p>

        {confirmationSent ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ color: '#10b981', fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>
              Check your inbox!
            </p>
            <p style={{ fontSize: '0.875rem', color: '#9ca3af', lineHeight: 1.5 }}>
              We sent a verification email to <strong>{formData.email}</strong>.<br />
              Click the link in the email to activate your account.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="st-auth__form">
            {mode === 'signup' && (
              <div className="st-auth__field">
                <label className="st-auth__label">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Jane Doe"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="st-auth__input"
                />
                {errors.fullName && <span className="st-auth__error">{errors.fullName}</span>}
              </div>
            )}

            <div className="st-auth__field">
              <label className="st-auth__label">Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="alex@example.com"
                value={formData.email}
                onChange={handleChange}
                className="st-auth__input"
              />
              {errors.email && <span className="st-auth__error">{errors.email}</span>}
            </div>

            <div className="st-auth__field">
              <label className="st-auth__label">Password</label>
              <div className="st-auth__input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="st-auth__input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="st-auth__toggle-pw"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <span className="st-auth__error">{errors.password}</span>}
            </div>

            {mode === 'signup' && (
              <div className="st-auth__field">
                <label className="st-auth__label">Confirm Password</label>
                <div className="st-auth__input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="st-auth__input"
                  />
                </div>
                {errors.confirmPassword && (
                  <span className="st-auth__error">{errors.confirmPassword}</span>
                )}
              </div>
            )}

            <button type="submit" className="st-auth__submit" disabled={loading}>
              {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};