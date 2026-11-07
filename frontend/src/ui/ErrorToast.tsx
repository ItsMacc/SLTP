// ErrorToast.tsx — Fixed-position error notification

import { useEffect } from 'react'
import Button from './Button'
import './ErrorToast.css'

interface ErrorToastProps {
  message: string
  onClose: () => void
  autoDismissMs?: number
}

export default function ErrorToast({
  message,
  onClose,
  autoDismissMs = 10000,
}: ErrorToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, autoDismissMs)
    return () => clearTimeout(timer)
  }, [message, onClose, autoDismissMs])

  return (
    <div className="error-toast" role="alert">
      <svg
        className="error-toast-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 4L22 19H2L12 4Z" />
        <line x1="12" y1="10" x2="12" y2="14" />
        <line x1="12" y1="16.5" x2="12" y2="16.5" />
      </svg>
      <p className="error-toast-text">{message}</p>
      <Button
        variant="ghost"
        size="icon"
        className="error-toast-close"
        onClick={onClose}
        aria-label="Dismiss error"
      >
        &times;
      </Button>
    </div>
  )
}