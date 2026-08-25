import React, { useState } from 'react'
import './Carousel.css'

type Slide = {
  eyebrow: string
  title: string
  body: string
  primary: string
  variant: 'image' | 'list'
  image?: string
  listItems?: Array<{ label: string; value: string }>
}

type CarouselProps = {
  playIntro: boolean
  onNavigate: (page: string) => void
}

const DEFAULT_VISUAL_IMAGE = '/images/carousel-visual.svg'
const CODE_IMAGE = "/images/code.png"

const slides: Slide[] = [
  {
    eyebrow: 'Investing, made understandable',
    title: 'Start investing without the complexity.',
    body: 'Choose a strategy that fits your goals, understand why it works, and let data help guide your decisions.',
    primary: 'Get Started',
    variant: 'image',
    image: DEFAULT_VISUAL_IMAGE,
  },
  {
    eyebrow: 'Built-in strategies',
    title: 'Choose a strategy that fits you.',
    body: 'Each built-in strategy is based on a single, understandable investment idea. Read how it thinks before you use it.',
    primary: 'Explore Strategies',
    variant: 'list',
    listItems: [
      { label: 'Buy & Hold', value: 'Long-term' },
      { label: 'MFI Mean Reversion', value: 'Money flow' },
      { label: 'Third strategy', value: 'Coming soon' },
    ],
  },
  {
    eyebrow: 'For advanced users',
    title: 'Want more control?',
    body: 'Build your own strategy using your own rules and ideas. Use our documentation to learn how to create a strategy and test it against historical data.',
    primary: 'Build a Strategy',
    variant: 'image',
    image: CODE_IMAGE,
  },
  {
    eyebrow: 'Historical analysis',
    title: 'See how your strategy would have performed.',
    body: 'Review historical results over 1, 5 and 10 years using daily market data before deciding whether a strategy fits you.',
    primary: 'View Performance',
    variant: 'list',
    listItems: [
      { label: '1Y', value: 'Short-term' },
      { label: '5Y', value: 'Baseline trend' },
      { label: '10Y', value: 'Long view' },
    ],
  },
]

const Carousel: React.FC<CarouselProps> = ({ playIntro, onNavigate }) => {
  const [index, setIndex] = useState(0)
  const current = slides[index]

  const goPrev = () => {
    setIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const goNext = () => {
    setIndex((prev) => (prev + 1) % slides.length)
  }

  const handlePrimaryClick = () => {
    if (current.primary === 'View Performance') {
      onNavigate('performance')
    } else if (current.primary === 'Explore Strategies') {
      onNavigate('strategies')
    } else {
      onNavigate('invest')
    }
  }

  const renderVisual = () => {
    if (current.variant === 'list') {
      const items = current.listItems ?? [
        { label: 'Buy & Hold', value: 'Long-term' },
        { label: 'MFI Mean Reversion', value: 'Money flow' },
      ]

      return (
        <div className="st-carousel__visual st-carousel__visual--list" aria-hidden="true">
          {items.map((item) => (
            <div key={`${current.title}-${item.label}`} className="st-carousel__option-row">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="st-carousel__visual st-carousel__visual--image" aria-hidden="true">
        <img
          src={current.image ?? DEFAULT_VISUAL_IMAGE}
          alt=""
          className="st-carousel__image"
        />
      </div>
    )
  }

  return (
    <section className={`st-carousel ${playIntro ? 'st-carousel--play' : ''}`} aria-label="Feature carousel">
      <div className="st-carousel__inner">
        <div className="st-carousel__frame" role="region" aria-live="polite">
          <div key={current.title} className="st-carousel__panel">
            <div className="st-carousel__copy">
              <p className="st-carousel__eyebrow">{current.eyebrow}</p>
              <h2 className="st-carousel__title">{current.title}</h2>
              <p className="st-carousel__body">{current.body}</p>

              <div className="st-carousel__actions">
                <button 
                  type="button" 
                  className="st-carousel__primary"
                  onClick={handlePrimaryClick}
                >
                  {current.primary}
                </button>
              </div>
            </div>

            {renderVisual()}
          </div>
        </div>

        <div className="st-carousel__footer">
          <div className="st-carousel__dots" role="tablist" aria-label="Carousel slides">
            {slides.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.title}
                className={`st-carousel__dot ${i === index ? 'is-active' : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>

          <div className="st-carousel__navs">
            <button type="button" className="st-carousel__nav st-carousel__nav--prev" aria-label="Previous slide" onClick={goPrev}>
              &lt;
            </button>
            <button type="button" className="st-carousel__nav st-carousel__nav--next" aria-label="Next slide" onClick={goNext}>
              &gt;
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Carousel