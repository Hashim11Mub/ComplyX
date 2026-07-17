// Alinma Bank mark: dark navy rounded square with a single white angled
// panel. Reconstructed by hand from a reference screenshot (no direct file
// access to the source asset) — swap the <path>/fill below if the exact
// brand SVG/PNG becomes available under frontend/public/.
export default function AlinmaLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="192" height="192" rx="46" fill="#071B2C" />
      <path d="M75 40 L131 17 L101 183 L75 160 Z" fill="#ffffff" />
    </svg>
  );
}
