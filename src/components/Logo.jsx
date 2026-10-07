export default function Logo({ className = 'brand-mark' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="#f97316" />
      <g fill="#fff">
        <circle cx="24" cy="25" r="8" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <rect key={deg} x="22.6" y="6.5" width="2.8" height="7" rx="1.4" transform={`rotate(${deg} 24 25)`} />
        ))}
      </g>
      <circle cx="21.3" cy="24" r="1.3" fill="#f97316" />
      <circle cx="26.7" cy="24" r="1.3" fill="#f97316" />
      <path d="M20.5 27.3c1.9 2.2 5.1 2.2 7 0" stroke="#f97316" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
