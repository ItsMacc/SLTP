import Carousel from '../components/Carousel'

interface PageProps {
  onNavigate: (page: string) => void
}

export default function HomePage({ onNavigate }: PageProps) {
  return (
    <div className="page-home">
      <Carousel playIntro={true} onNavigate={onNavigate} />
    </div>
  )
}