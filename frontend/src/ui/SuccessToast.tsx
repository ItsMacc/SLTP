// SuccessToast.tsx — Fixed-position success notification (mirrors ErrorToast)

import { useEffect } from 'react'
import Button from './Button'
import './SuccessToast.css'

interface SuccessToastProps {
  message: string
  onClose: () => void
  autoDismissMs?: number
}

export default function SuccessToast({
  message,
  onClose,
  autoDismissMs = 5000,
}: SuccessToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, autoDismissMs)
    return () => clearTimeout(timer)
  }, [message, onClose, autoDismissMs])

  return (
    <div className="success-toast" role="status" aria-live="polite">
      <svg
        className="success-toast-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12.5l2.5 2.5L16 9.5" />
      </svg>
      <p className="success-toast-text">{message}</p>
      <Button
        variant="ghost"
        size="icon"
        className="success-toast-close"
        onClick={onClose}
        aria-label="Dismiss notification"
      >
        &times;
      </Button>
    </div>
  )
}
