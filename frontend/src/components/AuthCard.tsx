// AuthCard.tsx — Sign in / sign up card
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { loginSchema, signUpSchema } from '../../lib/authSchema';
import { seedNewAccount } from '../../lib/learnApi';
import { provisionAccount } from '../../lib/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { LoaderInline, LoaderOverlay } from '../ui/Loader';
import './AuthCard.css';

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
  /**
   * Called once the credentials check out. It may be async: the card keeps
   * its loader up until the promise settles, so the sign-in covers the
   * account write in Turso as well as the sign-in itself.
   */
  onSuccess: (userProfile: { id?: string; email: string; name: string }) => void | Promise<void>;
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

        // Device security check: fires once per sign-in (best-effort, never
        // blocks or delays the login flow). See app/security.py.
        if (authData.session?.access_token) {
          fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/user/login-event`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData.session.access_token}`,
            },
            body: JSON.stringify({}),
          }).catch(() => {
            /* best-effort: device check must never break sign-in */
          });
        }

        await onSuccess({
          id: userId,
          email: userEmail,
          name: fetchedName || userEmail,
        });
      } else {
        const { data: signUpData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullNameInput.trim(),
            },
          },
        });

        if (authError) throw authError;

        // Generate this new account's badge set: a locked row for every
        // badge and trophy, plus an empty progress row. The auth.users
        // trigger already does this server-side; this call is idempotent and
        // covers the case where the browser is the only thing that ran.
        // Deliberately signup-only — never a backfill for existing accounts.
        const newUserId = signUpData.user?.id;
        if (newUserId) {
          // Best-effort: a failed seed must not block account creation.
          await seedNewAccount(newUserId).catch(() => ({ ok: false }));
        }

        // Populate Turso + Supabase with the shared defaults straight away.
        // Supabase only returns a session here when email confirmation is
        // OFF; with confirmation on there is nothing to authorise with yet,
        // and the first login provisions instead (see App.syncUser).
        const signupToken = signUpData.session?.access_token;
        if (signupToken) {
          await provisionAccount(signupToken, fullNameInput.trim());
        }

        setSuccessMsg('Account created. Check your email to confirm the address, then sign in.');
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

        <h2 className="st-auth__title">{isLogin ? 'Sign in' : 'Create an account'}</h2>
        <p className="st-auth__subtitle">
          {isLogin
            ? 'Your portfolio, your projects and your course progress are saved to your account.'
            : 'An account keeps your portfolio, your Lab projects and your course progress.'}
        </p>

        {successMsg && <div className="st-auth__success">{successMsg}</div>}

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
              {errors.fullName && <span className="st-auth__error">{errors.fullName}</span>}
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
            {errors.email && <span className="st-auth__error">{errors.email}</span>}
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
            {errors.password && <span className="st-auth__error">{errors.password}</span>}
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
              {errors.confirmPassword && <span className="st-auth__error">{errors.confirmPassword}</span>}
            </div>
          )}

          <div className="st-auth__submit-container">
            <Button type="submit" variant="primary" size="md" disabled={loading}>
              {loading ? (
                <>
                  <LoaderInline tone="inherit" />
                  {isLogin ? 'Signing in…' : 'Creating account…'}
                </>
              ) : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </div>
        </form>

        <div className="st-auth__footer">
          <span>{isLogin ? "Don't have an account? " : 'Already have an account? '}</span>
          <Button
            variant="link"
            size="md"
            className="st-auth__toggle-btn"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrors({});
              setSuccessMsg(null);
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </Button>
        </div>
      </div>

      {/* Signing in and signing up both write to the account store, so the
          whole page is held still while it happens. */}
      {loading && (
        <LoaderOverlay
          label={isLogin ? 'Signing in…' : 'Creating your account…'}
          sub="Checking your credentials and writing your account to the store."
        />
      )}
    </div>
  );
}