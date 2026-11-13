// Logo.tsx — Transparent brand mark used beside the SLTP wordmark in the
// header. The favicon still points at /logo.svg, which keeps its dark tile.
interface LogoProps {
  height?: number;
  className?: string;
}

export default function Logo({ height = 28, className = '' }: LogoProps) {
  return (
    <img
      src="/logo-mark.svg"
      alt=""
      height={height}
      className={`brand-logo ${className}`.trim()}
    />
  );
}
