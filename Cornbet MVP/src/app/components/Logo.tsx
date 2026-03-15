export function Logo() {
  return (
    <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
      {/* Glowing orb background */}
      <div
        className="absolute inset-0 blur-3xl"
        style={{
          background: 'radial-gradient(circle, #FFB300 0%, #F9A825 60%, transparent 100%)',
          opacity: 0.25,
          transform: 'scale(1.5)',
        }}
      />

      {/* Corn SVG illustration */}
      <svg
        viewBox="0 0 96 96"
        className="relative z-10 w-20 h-20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Corn husk leaves */}
        <path
          d="M48 78 C40 68 28 60 24 44 C32 52 42 58 48 68 Z"
          fill="#66BB6A"
          opacity="0.9"
        />
        <path
          d="M48 78 C56 68 68 60 72 44 C64 52 54 58 48 68 Z"
          fill="#81C784"
          opacity="0.9"
        />
        {/* Corn stalk */}
        <rect x="46" y="60" width="4" height="22" rx="2" fill="#8D6E63" opacity="0.8" />
        {/* Corn cob body */}
        <ellipse cx="48" cy="42" rx="13" ry="22" fill="url(#cornGradient)" />
        {/* Corn kernel rows - horizontal lines */}
        {[20, 25, 30, 35, 40, 45, 50, 55, 60].map((y, i) => (
          <line
            key={i}
            x1="36"
            y1={y}
            x2="60"
            y2={y}
            stroke="rgba(180, 120, 0, 0.35)"
            strokeWidth="1"
          />
        ))}
        {/* Corn kernel columns - vertical lines */}
        {[38, 42, 46, 50, 54, 58].map((x, i) => (
          <line
            key={i}
            x1={x}
            y1="20"
            x2={x}
            y2="64"
            stroke="rgba(180, 120, 0, 0.25)"
            strokeWidth="1"
          />
        ))}
        {/* Silk strands at top */}
        <path d="M44 20 C42 14 40 10 38 8" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <path d="M48 19 C47 12 46 8 45 6" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <path d="M52 20 C53 14 55 10 57 8" stroke="#FFD54F" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />

        {/* Highlight sheen */}
        <ellipse cx="44" cy="32" rx="4" ry="8" fill="rgba(255, 255, 255, 0.15)" />

        <defs>
          <linearGradient id="cornGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#E65100" stopOpacity="0.6" />
            <stop offset="20%" stopColor="#FFB300" stopOpacity="1" />
            <stop offset="50%" stopColor="#FFD54F" stopOpacity="1" />
            <stop offset="80%" stopColor="#FFB300" stopOpacity="1" />
            <stop offset="100%" stopColor="#E65100" stopOpacity="0.6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
