// Logo.tsx — Brand mark. Not rendered anywhere yet; drop <Logo /> into the
// header brand block or footer when the logo rollout happens.
interface LogoProps {
  height?: number;
  className?: string;
}

export default function Logo({ height = 28, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt="SLTP logo"
      height={height}
      className={`brand-logo ${className}`.trim()}
    />
  );
}
