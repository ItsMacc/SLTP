import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { loginSchema, signUpSchema } from '../../lib/authSchema';
import Button from '../ui/Button';
import Input from '../ui/Input';
import './AuthCard.css';

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
  onSuccess: (userProfile: { id?: string; email: string; name: string }) => void;
}

export function AuthCard({ initialMode = 'login', onSuccess }: AuthCardProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Flatten Zod issues into { fieldName: message } so errors can render under each input.
  function toFieldErrors(result: {
    error: { issues: Array<{ path: PropertyKey[]; message: string }> }
  }) {
    const fieldErrors: Record<string, string> = {};
    result.error.issues.forEach((issue) => {
      if (issue.path[0]) fieldErrors[issue.path[0].toString()] = issue.message;
    });
    return fieldErrors;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMsg(null);

    // Run Zod validation for the active mode before touching the auth API.
    if (isLogin) {
      const result = loginSchema.safeParse({ email, password });
      if (!result.success) {
        setErrors(toFieldErrors(result));
        return;
      }
    } else {
      const result = signUpSchema.safeParse({
        fullName: fullNameInput,
        email,
        password,
        confirmPassword,
      });
      if (!result.success) {
        setErrors(toFieldErrors(result));
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        const userId = authData.user?.id;
        const userEmail = authData.user?.email || email;
        let fetchedName = '';

        if (userId) {
          const { data: profileData, error: profileError } = await supabase
            .from('users')
            .select('name')
            .eq('id', userId)
            .single();

          if (!profileError && profileData?.name) {
            fetchedName = profileData.name;
          }
        }

        onSuccess({
          id: userId,
          email: userEmail,
          name: fetchedName || userEmail,
        });
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullNameInput.trim(),
            },
          },
        });

        if (authError) throw authError;

        setSuccessMsg('Account created successfully! Please check your email to verify your account before logging in.');
      }
    } catch (err: any) {
      setErrors({ email: err.message || 'An authentication error occurred' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="st-auth">
      <div className="st-auth__card">
        {/* Segmented Mode Switcher Tabs */}
        <div className="st-auth__tabs">
          <button
            type="button"
            className={`st-auth__tab ${isLogin ? 'is-active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setErrors({});
              setSuccessMsg(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`st-auth__tab ${!isLogin ? 'is-active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setErrors({});
              setSuccessMsg(null);
            }}
          >
            Sign Up
          </button>
        </div>

        <h2 className="st-auth__title">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="st-auth__subtitle">
          {isLogin ? 'Sign in to access your portfolio' : 'Get started with your trading account'}
        </p>

        {successMsg && <div className="st-auth__success" style={{ color: 'green', marginBottom: '1rem', fontSize: '0.9rem' }}>{successMsg}</div>}

        <form onSubmit={handleSubmit} className="st-auth__form">
          {!isLogin && (
            <div className="st-auth__field">
              <label className="st-auth__label" htmlFor="fullName">Full Name</label>
              <div className="st-auth__input-wrapper">
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your Name"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                />
              </div>
              {errors.fullName && <span className="st-auth__error" style={{ color: 'var(--error, #dc2626)', fontSize: '0.8rem' }}>{errors.fullName}</span>}
            </div>
          )}

          <div className="st-auth__field">
            <label className="st-auth__label" htmlFor="email">Email</label>
            <div className="st-auth__input-wrapper">
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {errors.email && <span className="st-auth__error" style={{ color: 'var(--error, #dc2626)', fontSize: '0.8rem' }}>{errors.email}</span>}
          </div>

          <div className="st-auth__field">
            <label className="st-auth__label" htmlFor="password">Password</label>
            <div className="st-auth__input-wrapper">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="st-auth__toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <span className="st-auth__error" style={{ color: 'var(--error, #dc2626)', fontSize: '0.8rem' }}>{errors.password}</span>}
          </div>

          {!isLogin && (
            <div className="st-auth__field">
              <label className="st-auth__label" htmlFor="confirmPassword">Confirm Password</label>
              <div className="st-auth__input-wrapper">
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {errors.confirmPassword && <span className="st-auth__error" style={{ color: 'var(--error, #dc2626)', fontSize: '0.8rem' }}>{errors.confirmPassword}</span>}
            </div>
          )}

          <div className="st-auth__submit-container">
            <Button type="submit" variant="primary" size="md" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </div>
        </form>

        <div className="st-auth__footer">
          <span>{isLogin ? "Don't have an account? " : 'Already have an account? '}</span>
          <button
            type="button"
            className="st-auth__toggle-btn"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrors({});
              setSuccessMsg(null);
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}