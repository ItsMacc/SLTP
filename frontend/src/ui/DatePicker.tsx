// DatePicker.tsx — Date input with calendar popup

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'
import './DatePicker.css'

interface DatePickerProps {
  id: string
  label?: string
  value: string
  onChange: (dateStr: string) => void
  error?: string
  placeholder?: string
  /** Earliest selectable day (ISO). Phones pass their five-year floor. */
  min?: string
}

// days: day grid, months: twelve months of one year, years: one page of years.
type CalendarView = 'days' | 'months' | 'years'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// The price history starts in 1998, so a date before it is reported as its first day.
const MIN_DATE = '1998-01-01'
const YEARS_PER_PAGE = 12

const DROPDOWN_WIDTH = 300
const DROPDOWN_EST_HEIGHT = 340

const pad2 = (n: number) => String(n).padStart(2, '0')

const toDateString = (year: number, month: number, day: number) =>
  `${year}-${pad2(month + 1)}-${pad2(day)}`

export default function DatePicker({
  id,
  label,
  value,
  onChange,
  error,
  placeholder = 'YYYY-MM-DD',
  min = MIN_DATE,
}: DatePickerProps) {
  // Zero-padded ISO strings compare correctly as text, so the floor is one line.
  const floor = min
  const floorYear = Number(floor.slice(0, 4))
  const floorMonth = Number(floor.slice(5, 7)) - 1
  const clampToMin = (dateStr: string) => (dateStr < floor ? floor : dateStr)
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<CalendarView>('days')
  const [yearPage, setYearPage] = useState<number>(0)
  const [inputValue, setInputValue] = useState(value || '')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
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
      const target = e.target as Node
      // The calendar lives in a body portal, so it is outside the field's
      // container by design; a click inside it must not count as outside.
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setIsOpen(false)
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
    // Phones centre the popup on the screen: tucked under the field's left
    // edge it overhangs the right side of a 390px screen and reads as off.
    const centered = window.innerWidth < 480
    const left = centered
      ? Math.max(8, Math.round((window.innerWidth - DROPDOWN_WIDTH) / 2))
      : Math.min(rect.left, Math.max(8, window.innerWidth - DROPDOWN_WIDTH - 8))
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

  // Always reopen on the day grid, on the page that holds the year in view.
  const toggleCalendar = () => {
    setIsOpen((prev) => {
      if (!prev) {
        setView('days')
        setYearPage(Math.floor((currentYear - floorYear) / YEARS_PER_PAGE))
      }
      return !prev
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      const clamped = clampToMin(val)
      setInputValue(clamped)
      onChange(clamped)
      const d = new Date(clamped + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setCurrentMonth(d.getMonth())
        setCurrentYear(d.getFullYear())
      }
    }
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (atFirstMonth) return
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

  const openYears = () => {
    setYearPage(Math.floor((currentYear - floorYear) / YEARS_PER_PAGE))
    setView('years')
  }

  const handleSelectMonth = (month: number) => {
    setCurrentMonth(month)
    setView('days')
  }

  const handleSelectYear = (year: number) => {
    const next = Math.max(floorYear, year)
    setCurrentYear(next)
    if (next === floorYear) setCurrentMonth(floorMonth)
    setView('months')
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
    const formatted = clampToMin(toDateString(y, m, d))
    setInputValue(formatted)
    onChange(formatted)
    setView('days')
    setIsOpen(false)
  }

  const yearPageStart = floorYear + yearPage * YEARS_PER_PAGE
  const pageYears = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i)
  const atFirstMonth = currentYear === floorYear && currentMonth === floorMonth

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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="calendar-toggle-btn"
          onClick={toggleCalendar}
          aria-label="Toggle calendar"
        >
          <svg className="calendar-icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </Button>
      </div>

      {error && <span className="custom-datepicker-error">{error}</span>}

      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="custom-calendar-dropdown"
          style={{
            position: 'fixed',
            left: dropdownPos.left,
            top: dropdownPos.top,
            width: DROPDOWN_WIDTH,
          }}
        >
          {view === 'days' && (
            <>
              <div className="calendar-header">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handlePrevMonth}
                  disabled={atFirstMonth}
                  aria-label="Previous month"
                >
                  &lt;
                </Button>
                <div className="cal-header-titles">
                  <button
                    type="button"
                    className="cal-title-btn"
                    onClick={() => setView('months')}
                    aria-label={`Choose month, currently ${MONTH_NAMES[currentMonth]}`}
                  >
                    {MONTH_NAMES[currentMonth]}
                  </button>
                  <button
                    type="button"
                    className="cal-title-btn"
                    onClick={openYears}
                    aria-label={`Choose year, currently ${currentYear}`}
                  >
                    {currentYear}
                  </button>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={handleNextMonth} aria-label="Next month">
                  &gt;
                </Button>
              </div>

              <div className="calendar-weekdays">
                {DAYS_OF_WEEK.map((w) => (
                  <span key={w} className="cal-weekday">{w}</span>
                ))}
              </div>

              <div className="calendar-grid">
                {calendarDays.map(({ day, month, year, isCurrentMonth }, idx) => {
                  const dateStr = toDateString(year, month, day)
                  const isSelected = value === clampToMin(dateStr)

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
            </>
          )}

          {view === 'months' && (
            <>
              <div className="calendar-header">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentYear((y) => Math.max(floorYear, y - 1))}
                  disabled={currentYear <= floorYear}
                  aria-label="Previous year"
                >
                  &lt;
                </Button>
                <button type="button" className="cal-title-btn" onClick={openYears}>
                  {currentYear}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setCurrentYear((y) => y + 1)}
                  aria-label="Next year"
                >
                  &gt;
                </Button>
              </div>

              <div className="cal-option-grid">
                {MONTH_NAMES.map((name, index) => (
                  <button
                    key={name}
                    type="button"
                    className={`cal-option-btn ${index === currentMonth ? 'selected' : ''}`}
                    onClick={() => handleSelectMonth(index)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'years' && (
            <>
              <div className="calendar-header">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setYearPage((p) => Math.max(0, p - 1))}
                  disabled={yearPage === 0}
                  aria-label="Previous years"
                >
                  &lt;
                </Button>
                <span className="cal-range-label">
                  {yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setYearPage((p) => p + 1)}
                  aria-label="Next years"
                >
                  &gt;
                </Button>
              </div>

              <div className="cal-option-grid">
                {pageYears.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={`cal-option-btn ${year === currentYear ? 'selected' : ''}`}
                    onClick={() => handleSelectYear(year)}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
