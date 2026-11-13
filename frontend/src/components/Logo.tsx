// Logo.tsx — Brand mark used beside the SLTP wordmark in the header.
interface LogoProps {
  height?: number;
  className?: string;
}

export default function Logo({ height = 28, className = '' }: LogoProps) {
  return (
    <img
      src="/logo.svg"
      alt=""
      height={height}
      className={`brand-logo ${className}`.trim()}
    />
  );
}
