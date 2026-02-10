'use client';

export function DancingAnimal() {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
      style={{ zIndex: 9999 }}
    >
      <svg
        width="80"
        height="80"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-bounce"
      >
        <style>{`
          @keyframes ear-wiggle {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-15deg); }
            75% { transform: rotate(15deg); }
          }
          @keyframes tail-wag {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(25deg); }
          }
          @keyframes paw-wave {
            0%, 100% { transform: rotate(0deg) translateY(0); }
            50% { transform: rotate(-30deg) translateY(-5px); }
          }
          .ear-left {
            animation: ear-wiggle 0.8s ease-in-out infinite;
            transform-origin: 35px 25px;
          }
          .ear-right {
            animation: ear-wiggle 0.8s ease-in-out infinite 0.2s;
            transform-origin: 65px 25px;
          }
          .tail {
            animation: tail-wag 1s ease-in-out infinite;
            transform-origin: 75px 60px;
          }
          .paw-left {
            animation: paw-wave 0.6s ease-in-out infinite;
            transform-origin: 38px 70px;
          }
          .paw-right {
            animation: paw-wave 0.6s ease-in-out infinite 0.3s;
            transform-origin: 62px 70px;
          }
        `}</style>

        {/* Tail */}
        <path
          className="tail"
          d="M 75 60 Q 85 45 90 30"
          stroke="#FF6B6B"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />

        {/* Body */}
        <ellipse cx="50" cy="55" rx="25" ry="20" fill="#FF8C42" />

        {/* Head */}
        <circle cx="50" cy="35" r="18" fill="#FFA94D" />

        {/* Left Ear */}
        <path
          className="ear-left"
          d="M 35 25 L 30 15 L 38 20 Z"
          fill="#FF8C42"
        />

        {/* Right Ear */}
        <path
          className="ear-right"
          d="M 65 25 L 70 15 L 62 20 Z"
          fill="#FF8C42"
        />

        {/* Left Eye */}
        <circle cx="43" cy="33" r="3" fill="#2C3E50">
          <animate
            attributeName="r"
            values="3;1;3"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Right Eye */}
        <circle cx="57" cy="33" r="3" fill="#2C3E50">
          <animate
            attributeName="r"
            values="3;1;3"
            dur="3s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Nose */}
        <circle cx="50" cy="38" r="2" fill="#E74C3C" />

        {/* Mouth */}
        <path
          d="M 50 38 Q 45 42 43 40"
          stroke="#2C3E50"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 50 38 Q 55 42 57 40"
          stroke="#2C3E50"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Left Front Paw */}
        <ellipse
          className="paw-left"
          cx="38"
          cy="70"
          rx="5"
          ry="8"
          fill="#FFA94D"
        />

        {/* Right Front Paw */}
        <ellipse
          className="paw-right"
          cx="62"
          cy="70"
          rx="5"
          ry="8"
          fill="#FFA94D"
        />

        {/* Left Back Paw */}
        <ellipse cx="35" cy="72" rx="6" ry="5" fill="#FF8C42" />

        {/* Right Back Paw */}
        <ellipse cx="65" cy="72" rx="6" ry="5" fill="#FF8C42" />

        {/* Whiskers */}
        <line x1="30" y1="37" x2="20" y2="35" stroke="#2C3E50" strokeWidth="1" />
        <line x1="30" y1="39" x2="20" y2="40" stroke="#2C3E50" strokeWidth="1" />
        <line x1="70" y1="37" x2="80" y2="35" stroke="#2C3E50" strokeWidth="1" />
        <line x1="70" y1="39" x2="80" y2="40" stroke="#2C3E50" strokeWidth="1" />
      </svg>
    </div>
  );
}
