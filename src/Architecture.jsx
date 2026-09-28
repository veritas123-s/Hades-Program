import React from "react";
// Architectural ornament only: no emblems, flags, slogans or political figures.
export default function Architecture() {
  return (
    <div className="monument-banner">
      <div className="monument-copy">
        <span>THE ART OF A PURPOSEFUL DAY</span>
        <h2>以秩序，筑自由。</h2>
        <p>每一份专注，都在构筑更辽阔的自己。</p>
        <div className="architectural-rule">
          <i /> VERITAS · MMXXVI <i />
        </div>
      </div>
      <svg
        viewBox="0 0 840 270"
        aria-label="石材柱廊与对称塔楼的建筑装饰"
        role="img"
      >
        <defs>
          <linearGradient id="stone" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f4e9cd" />
            <stop offset="1" stopColor="#bba77d" />
          </linearGradient>
          <linearGradient id="arch-sky">
            <stop stopColor="#312d27" />
            <stop offset="1" stopColor="#706144" />
          </linearGradient>
          <pattern
            id="windows"
            width="19"
            height="23"
            patternUnits="userSpaceOnUse"
          >
            <rect x="6" y="5" width="6" height="13" fill="#4c4232" />
            <path d="M4 20H14" stroke="#deca9b" strokeWidth="1" />
          </pattern>
        </defs>
        <circle
          cx="433"
          cy="132"
          r="114"
          fill="none"
          stroke="#a3905d"
          opacity=".2"
        />
        <circle
          cx="433"
          cy="132"
          r="98"
          fill="none"
          stroke="#c4aa69"
          opacity=".15"
        />
        <path
          d="M0 253H840M0 268H840M82 253L0 270M742 253L840 270M241 253L181 270M601 253L661 270"
          stroke="#c9b381"
          opacity=".55"
        />
        <g fill="url(#stone)" stroke="#84704b" strokeWidth="1">
          <path d="M130 238V158H297V124H353V70H390V46H409V30H429V11H436V30H456V46H475V70H514V124H570V158H730V238Z" />
          <path d="M111 241H750V250H111ZM121 151H299V159H121ZM567 151H740V159H567ZM345 66H520V73H345ZM382 42H482V48H382ZM400 27H464V32H400Z" />
        </g>
        <g fill="url(#windows)">
          <rect x="365" y="83" width="136" height="100" />
          <rect x="307" y="134" width="43" height="81" />
          <rect x="523" y="134" width="38" height="81" />
        </g>
        <g stroke="#c7b078" strokeWidth="2">
          <path d="M366 83V207M385 83V207M482 83V207M501 83V207" />
          <path d="M137 166H290M573 166H719" />
        </g>
        {[150, 178, 206, 234, 262, 588, 616, 644, 672, 700].map((x) => (
          <g key={x}>
            <rect x={x - 8} y="177" width="17" height="56" fill="#473b2d" />
            <path
              d={`M${x - 6} 236V185Q${x} 171 ${x + 6} 185V236`}
              fill="none"
              stroke="#e4d2aa"
              strokeWidth="5"
            />
            <path
              d={`M${x - 10} 236H${x + 10}M${x - 10} 176H${x + 10}`}
              stroke="#f3e4c4"
              strokeWidth="4"
            />
          </g>
        ))}
        <path
          d="M396 238V213Q432 160 469 213V238"
          fill="url(#arch-sky)"
          stroke="#ecd9ae"
          strokeWidth="9"
        />
        <path
          d="M404 238V214Q432 177 460 214V238"
          fill="none"
          stroke="#ba9c63"
          strokeWidth="2"
        />
        <g fill="#d9c697">
          <rect x="375" y="195" width="10" height="43" />
          <rect x="480" y="195" width="10" height="43" />
        </g>
        <path
          d="M354 188H511M356 180H510M389 239H477M379 244H487M366 249H500"
          stroke="#f0dfb7"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}
