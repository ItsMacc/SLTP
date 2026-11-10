// GuideTabs.tsx: Chapter switcher shared by the Research page guides.
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Button from '../ui/Button'

export interface GuideTab {
  id: string
  label: string
}

interface GuideTabsProps {
  tabs: GuideTab[]
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  /** Id of the single panel every tab controls. */
  panelId: string
}

export default function GuideTabs({ tabs, value, onChange, ariaLabel, panelId }: GuideTabsProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const focusTab = (index: number) => {
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus()
  }

  const move = (from: number, step: number) => {
    const next = (from + step + tabs.length) % tabs.length
    const tab = tabs[next]
    if (!tab) return
    onChange(tab.id)
    focusTab(next)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(tabs[0]!.id)
      focusTab(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(tabs[tabs.length - 1]!.id)
      focusTab(tabs.length - 1)
    }
  }

  return (
    <div className="guide-tabs" role="tablist" aria-label={ariaLabel} ref={listRef}>
      {tabs.map((tab, index) => {
        const active = tab.id === value
        return (
          <Button
            key={tab.id}
            type="button"
            variant="secondary"
            size="md"
            role="tab"
            id={`${panelId}-tab-${tab.id}`}
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            className={`guide-tab${active ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}
          </Button>
        )
      })}
    </div>
  )
}
