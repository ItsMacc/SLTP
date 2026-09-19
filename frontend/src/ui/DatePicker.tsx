// DatePicker.tsx — Date input with calendar popup

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import './DatePicker.css'

interface DatePickerProps {
  id: string
  label?: string
  value: string
  onChange: (dateStr: string) => void
  error?: string
  placeholder?: string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const DROPDOWN_WIDTH = 300
const DROPDOWN_EST_HEIGHT = 320

export default function DatePicker({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'YYYY-MM-DD',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null)

  const initialDate = value ? new Date(value + 'T00:00:00') : new Date()
  const [currentMonth, setCurrentMonth] = useState(isNaN(initialDate.getTime()) ? new Date().getMonth() : initialDate.getMonth())
  const [currentYear, setCurrentYear] = useState(isNaN(initialDate.getTime()) ? new Date().getFullYear() : initialDate.getFullYear())

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value)
      const d = new Date(value + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setCurrentMonth(d.getMonth())
        setCurrentYear(d.getFullYear())
      }
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Position the calendar with fixed positioning so it is never clipped by
  // scroll containers (e.g. the horizontally scrollable strategy controls bar).
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownPos(null)
      return
    }
    const el = inputContainerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - DROPDOWN_WIDTH - 8))
    const spaceBelow = window.innerHeight - rect.bottom
    const top =
      spaceBelow >= DROPDOWN_EST_HEIGHT + 12
        ? rect.bottom + 6
        : Math.max(8, rect.top - DROPDOWN_EST_HEIGHT - 6)
    setDropdownPos({ left, top })
  }, [isOpen])

  // Close the calendar if the page or any scroll container scrolls while open.
  useEffect(() => {
    if (!isOpen) return
    const close = (e: Event) => {
      if (e.target instanceof Node && containerRef.current?.contains(e.target)) return
      setIsOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      onChange(val)
      const d = new Date(val + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setCurrentMonth(d.getMonth())
        setCurrentYear(d.getFullYear())
      }
    }
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate()

  const calendarDays: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = []

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevM = currentMonth === 0 ? 11 : currentMonth - 1
    const prevY = currentMonth === 0 ? currentYear - 1 : currentYear
    calendarDays.push({ day: daysInPrevMonth - i, month: prevM, year: prevY, isCurrentMonth: false })
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, month: currentMonth, year: currentYear, isCurrentMonth: true })
  }

  const remainingCells = 42 - calendarDays.length
  for (let i = 1; i <= remainingCells; i++) {
    const nextM = currentMonth === 11 ? 0 : currentMonth + 1
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear
    calendarDays.push({ day: i, month: nextM, year: nextY, isCurrentMonth: false })
  }

  const handleSelectDate = (d: number, m: number, y: number) => {
    const mm = String(m + 1).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const formatted = `${y}-${mm}-${dd}`
    setInputValue(formatted)
    onChange(formatted)
    setIsOpen(false)
  }

  return (
    <div className="custom-datepicker-wrapper" ref={containerRef}>
      {label && <label htmlFor={id} className="custom-datepicker-label">{label}</label>}
      
      <div ref={inputContainerRef} className={`custom-datepicker-input-container ${error ? 'has-error' : ''}`}>
        <input
          id={id}
          type="text"
          className="custom-datepicker-text-input"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="calendar-toggle-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle calendar"
        >
          <svg className="calendar-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>
      </div>

      {error && <span className="custom-datepicker-error">{error}</span>}

      {isOpen && dropdownPos && (
        <div
          className="custom-calendar-dropdown"
          style={{
            position: 'fixed',
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: DROPDOWN_WIDTH,
          }}
        >
          <div className="calendar-header">
            <button type="button" className="cal-nav-btn" onClick={handlePrevMonth}>&lt;</button>
            <span className="cal-month-title">{MONTH_NAMES[currentMonth]} {currentYear}</span>
            <button type="button" className="cal-nav-btn" onClick={handleNextMonth}>&gt;</button>
          </div>

          <div className="calendar-weekdays">
            {DAYS_OF_WEEK.map((w) => (
              <span key={w} className="cal-weekday">{w}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map(({ day, month, year, isCurrentMonth }, idx) => {
              const mm = String(month + 1).padStart(2, '0')
              const dd = String(day).padStart(2, '0')
              const dateStr = `${year}-${mm}-${dd}`
              const isSelected = value === dateStr

              return (
                <button
                  key={idx}
                  type="button"
                  className={`cal-day-btn ${!isCurrentMonth ? 'outside-month' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectDate(day, month, year)}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}