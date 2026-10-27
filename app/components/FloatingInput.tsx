'use client';

import { useState } from 'react';

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * Floating-label input — implements the Stitch "Ethereal Sanctuary" spec:
 * • 56px height, rounded-2xl, white fill, subtle border
 * • Label floats to label-sm on focus or when a value is present
 * • Focus ring: sage border + soft blue-cloud outer glow
 * • Automatically adds an accessible Show / Hide Password toggle when type="password"
 */
export default function FloatingInput({ label, id, type, ...props }: FloatingInputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasValue = Boolean(props.value);
  const lifted = focused || hasValue;
  const isPasswordField = type === 'password';
  const effectiveType = isPasswordField ? (showPassword ? 'text' : 'password') : type;

  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="relative w-full" style={{ height: '56px' }}>
      <input
        id={inputId}
        type={effectiveType}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholder=""
        className={`peer w-full h-full rounded-2xl pl-4 ${
          isPasswordField ? 'pr-12' : 'pr-4'
        } pt-5 pb-2 text-base sm:text-[0.9375rem] outline-none transition-all`}
        style={{
          backgroundColor: '#ffffff',
          border: `1px solid ${focused ? '#7e9a88' : 'var(--color-border)'}`,
          boxShadow: focused
            ? '0 0 0 3px rgba(154,183,211,0.35)'
            : '0 4px 20px -2px rgba(26,30,28,0.04)',
          color: 'var(--color-charcoal)',
          fontFamily: 'var(--font-body)',
        }}
      />
      <label
        htmlFor={inputId}
        className="pointer-events-none absolute left-4 transition-all duration-150 select-none"
        style={{
          top: lifted ? '8px' : '50%',
          transform: lifted ? 'none' : 'translateY(-50%)',
          fontSize: lifted ? '0.6875rem' : '0.9375rem',
          fontWeight: lifted ? 500 : 400,
          letterSpacing: lifted ? '0.04em' : '-0.005em',
          color: lifted ? '#7e9a88' : 'rgba(26,30,28,0.45)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {label}
      </label>

      {/* Show/Hide Password Eye Toggle */}
      {isPasswordField && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-[#4a6454] transition-colors cursor-pointer focus:outline-none"
        >
          {showPassword ? (
            /* Eye Off / Slash Icon */
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            /* Eye Icon */
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
