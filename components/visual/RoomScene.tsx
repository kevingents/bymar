import { useId } from "react";
import { lookFor, type StyleLook } from "@/lib/styles";

/**
 * Geïllustreerde woonkamer in de stijl van een project. Puur SVG: geen afbeeldingen,
 * schaalt overal mee en verandert van kleur en vorm per stijl.
 */
export function RoomScene({
  style,
  look: lookProp,
  className,
  title,
}: {
  style?: string | null;
  look?: StyleLook;
  className?: string;
  title?: string;
}) {
  const look = lookProp ?? lookFor(style);
  const c = look.colors;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (s: string) => `${s}-${uid}`;
  const has = (e: StyleLook["extras"][number]) => look.extras.includes(e);

  // Raam
  const win =
    look.window === "tall"
      ? { x: 40, y: 22, w: 82, h: 158 }
      : look.window === "arch"
        ? { x: 36, y: 34, w: 92, h: 140 }
        : { x: 34, y: 40, w: 98, h: 112 };
  const winPath =
    look.window === "arch"
      ? `M${win.x} ${win.y + win.h} V${win.y + win.w / 2} A${win.w / 2} ${win.w / 2} 0 0 1 ${win.x + win.w} ${win.y + win.w / 2} V${win.y + win.h} Z`
      : `M${win.x} ${win.y} H${win.x + win.w} V${win.y + win.h} H${win.x} Z`;

  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className={className} role="img" aria-label={title ?? `Kamer in ${look.name}-stijl`}>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.sky} />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id={id("wall")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={id("floor")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000000" stopOpacity="0.12" />
          <stop offset="0.3" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id("glow")}>
          <stop offset="0" stopColor="#FFE6B8" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFE6B8" stopOpacity="0" />
        </radialGradient>
        <pattern id={id("brick")} width="36" height="18" patternUnits="userSpaceOnUse">
          <rect width="36" height="18" fill={c.wall} />
          <path d="M0 0.5H36M0 9.5H36M18 0V9M0 9V18M36 9V18" stroke="#000" strokeOpacity="0.14" strokeWidth="1" />
        </pattern>
        <clipPath id={id("win")}>
          <path d={winPath} />
        </clipPath>
      </defs>

      {/* Muur */}
      <rect width="400" height="216" fill={has("brick") ? `url(#${id("brick")})` : c.wall} />
      {has("texture") &&
        [
          [60, 40, 46],
          [210, 30, 60],
          [330, 120, 52],
          [150, 150, 40],
          [380, 30, 36],
        ].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#000" opacity="0.035" />)}
      {has("panels") && (
        <g fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2">
          <rect x="150" y="150" width="105" height="52" />
          <rect x="265" y="150" width="105" height="52" />
          <rect x="150" y="24" width="220" height="112" />
          <path d="M0 144H400" strokeOpacity="0.6" />
        </g>
      )}
      <rect width="400" height="216" fill={`url(#${id("wall")})`} />
      {has("beams") && (
        <g fill={c.wood}>
          <rect x="0" y="0" width="400" height="12" />
          <rect x="0" y="12" width="400" height="3" opacity="0.5" />
        </g>
      )}

      {/* Vloer */}
      <rect y="214" width="400" height="86" fill={c.floor} />
      <g stroke={c.floorLine} strokeWidth="1.2">
        {[232, 252, 276].map((y) => (
          <path key={y} d={`M0 ${y}H400`} />
        ))}
        {[-60, 20, 100, 180, 260, 340, 420].map((x, i) => (
          <path key={i} d={`M${x + (i % 2) * 30} 214 L${x * 1.25 - 50 + (i % 2) * 38} 300`} strokeOpacity="0.55" />
        ))}
      </g>
      <rect y="214" width="400" height="86" fill={`url(#${id("floor")})`} />
      <rect y="209" width="400" height="7" fill={c.wall} />
      <rect y="214" width="400" height="2" fill="#000" opacity="0.08" />

      {/* Zonlicht van het raam op de vloer */}
      <path
        d={`M${win.x + 6} 216 L${win.x + win.w - 4} 216 L${win.x + win.w + 70} 300 L${win.x + 30} 300 Z`}
        fill="#fff"
        opacity="0.16"
      />

      {/* Raam */}
      <g>
        <path d={winPath} fill={`url(#${id("sky")})`} />
        <g clipPath={`url(#${id("win")})`}>
          <ellipse cx={win.x + win.w * 0.3} cy={win.y + win.h * 0.85} rx="50" ry="22" fill={c.plant} opacity="0.35" />
          <ellipse cx={win.x + win.w * 0.85} cy={win.y + win.h * 0.92} rx="40" ry="18" fill={c.plant} opacity="0.25" />
        </g>
        <path d={winPath} fill="none" stroke="#fff" strokeWidth="5" />
        <path d={`M${win.x + win.w / 2} ${win.y + (look.window === "arch" ? 6 : 0)}V${win.y + win.h}M${win.x} ${win.y + win.h * 0.55}H${win.x + win.w}`} stroke="#fff" strokeWidth="3" />
        <rect x={win.x - 6} y={win.y + win.h} width={win.w + 12} height="6" rx="2" fill="#fff" />
      </g>
      {has("curtain") && (
        <g>
          {[win.x - 18, win.x + win.w + 2].map((x, i) => (
            <g key={i}>
              <path d={`M${x} ${win.y - 10} h16 v${win.h + 40} q-8 6 -16 0 Z`} fill={c.cushion} opacity="0.85" />
              <path d={`M${x + 5} ${win.y - 6}v${win.h + 38}M${x + 11} ${win.y - 6}v${win.h + 38}`} stroke="#000" strokeOpacity="0.08" strokeWidth="1.5" />
            </g>
          ))}
          <rect x={win.x - 24} y={win.y - 14} width={win.w + 48} height="4" rx="2" fill={c.metal} />
        </g>
      )}

      {/* Kunst / spiegel boven de bank */}
      {has("mirror") ? (
        <g>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2;
            return <path key={i} d={`M${268 + Math.cos(a) * 32} ${82 + Math.sin(a) * 32}L${268 + Math.cos(a) * 44} ${82 + Math.sin(a) * 44}`} stroke={c.wood} strokeWidth="3" strokeLinecap="round" />;
          })}
          <circle cx="268" cy="82" r="30" fill="#E9EEF0" stroke={c.wood} strokeWidth="4" />
          <path d="M252 72 q8 -10 22 -6" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      ) : has("gallery") ? (
        <g>
          <rect x="214" y="52" width="44" height="58" fill="#fff" stroke={c.metal} strokeWidth="2.5" />
          <rect x="220" y="58" width="32" height="46" fill={c.art1} />
          <rect x="266" y="62" width="58" height="40" fill="#fff" stroke={c.metal} strokeWidth="2.5" />
          <path d="M272 96 L288 76 L300 88 L308 80 L318 96 Z" fill={c.art2} />
          <circle cx="309" cy="72" r="5" fill={c.art1} />
          <rect x="332" y="56" width="26" height="26" fill="#fff" stroke={c.metal} strokeWidth="2.5" />
          <circle cx="345" cy="69" r="7" fill={c.art2} />
        </g>
      ) : (
        <g>
          <rect x="236" y="48" width="72" height="72" fill="#fff" stroke={c.wood} strokeWidth="3" />
          <path d="M248 112 V86 A24 24 0 0 1 296 86 V112 Z" fill={c.art2} />
          <circle cx="283" cy="70" r="8" fill={c.art1} />
        </g>
      )}

      {has("shelf") && !has("mirror") && (
        <g>
          <rect x="150" y="96" width="62" height="5" rx="1" fill={c.wood} />
          <rect x="156" y="78" width="7" height="18" fill={c.art1} />
          <rect x="164" y="82" width="6" height="14" fill={c.cushion} />
          <rect x="171" y="80" width="5" height="16" fill={c.accent} opacity="0.8" />
          <path d="M190 96 q-3 -12 4 -16 q7 4 4 16 Z" fill={c.art2} />
          <circle cx="204" cy="91" r="5" fill={c.plant} />
        </g>
      )}

      {has("macrame") && (
        <g stroke="#E8DCC7" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M330 18H372" stroke={c.wood} strokeWidth="4" />
          {[334, 342, 350, 358, 366].map((x, i) => (
            <path key={i} d={`M${x} 18 L${351} ${56 + (i % 2) * 6} L${x} 100`} />
          ))}
          <path d="M344 100v14M351 100v18M358 100v14" />
        </g>
      )}

      {/* Lamp-gloed */}
      <circle cx={look.lamp === "arc" ? 300 : 378} cy={look.lamp === "arc" ? 104 : 110} r="62" fill={`url(#${id("glow")})`} />

      {/* Plant */}
      <g>
        {[
          [-0.9, 70, c.plant],
          [-0.4, 90, c.plant],
          [0.1, 96, c.plant],
          [0.55, 82, c.plant],
          [0.95, 64, c.plant],
          [-0.15, 60, "#000"],
        ].map(([a, len, col], i) => {
          const ang = (a as number) - Math.PI / 2;
          const x2 = 152 + Math.cos(ang) * (len as number);
          const y2 = 190 + Math.sin(ang) * (len as number);
          return (
            <g key={i} opacity={col === "#000" ? 0.12 : 1}>
              <path d={`M152 190 Q${(152 + x2) / 2 + 6} ${(190 + y2) / 2} ${x2} ${y2}`} stroke={col === "#000" ? "#000" : c.plant} strokeWidth="2" fill="none" />
              <ellipse cx={x2} cy={y2} rx="13" ry="7" transform={`rotate(${((a as number) * 180) / Math.PI - 90} ${x2} ${y2})`} fill={col as string} />
            </g>
          );
        })}
        <path d="M137 186 h30 l-4 30 h-22 Z" fill={has("brick") ? "#3a3a3a" : "#E9E2D6"} />
        <path d="M137 186 h30 v4 h-30 Z" fill="#000" opacity="0.08" />
      </g>

      {/* Vloerkleed */}
      <path d="M175 228 L388 228 L400 290 L160 290 Z" fill={c.rug} />
      <path d="M182 234 L381 234 L391 284 L169 284 Z" fill="none" stroke="#000" strokeOpacity="0.09" strokeWidth="2" strokeDasharray={look.name === "Boho" || look.name === "Eclectisch" ? "6 5" : undefined} />

      {/* Bank */}
      <Sofa look={look} />

      {/* Salontafel */}
      <g>
        <ellipse cx="275" cy="262" rx="58" ry="6" fill="#000" opacity="0.1" />
        {look.sofa === "curvy" || look.window === "arch" ? (
          <>
            <ellipse cx="275" cy="240" rx="50" ry="10" fill={c.wood} />
            <ellipse cx="275" cy="238" rx="50" ry="10" fill={c.wood} />
            <ellipse cx="275" cy="237" rx="46" ry="7" fill="#fff" opacity="0.12" />
            <path d="M250 246 l-6 16M300 246 l6 16M275 248v14" stroke={c.wood} strokeWidth="3.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="228" y="234" width="94" height="8" rx="2" fill={c.wood} />
            <rect x="234" y="242" width="4" height="18" fill={c.metal} />
            <rect x="312" y="242" width="4" height="18" fill={c.metal} />
          </>
        )}
        {has("vase") ? (
          <g>
            <path d="M262 236 q-6 -12 2 -22 h8 q8 10 2 22 Z" fill={c.art2} />
            <path d="M268 214 q-4 -18 -14 -26M268 214 q2 -16 12 -24M268 214 q0 -14 -2 -30" stroke={c.accent} strokeWidth="1.4" fill="none" />
          </g>
        ) : (
          <g>
            <rect x="256" y="226" width="26" height="6" rx="1" fill={c.art1} />
            <rect x="259" y="221" width="20" height="5" rx="1" fill={c.cushion} />
            <circle cx="300" cy="230" r="5" fill={c.plant} />
          </g>
        )}
      </g>

      {/* Lamp */}
      <Lamp look={look} />
    </svg>
  );
}

function Sofa({ look }: { look: StyleLook }) {
  const c = look.colors;
  switch (look.sofa) {
    case "low":
      return (
        <g>
          <ellipse cx="272" cy="214" rx="96" ry="6" fill="#000" opacity="0.12" />
          <rect x="186" y="140" width="172" height="40" rx="8" fill={c.sofaDark} />
          <rect x="182" y="170" width="180" height="34" rx="8" fill={c.sofa} />
          <rect x="192" y="146" width="40" height="30" rx="8" fill={c.cushion} />
          <rect x="314" y="148" width="36" height="28" rx="8" fill={c.sofa} />
          <rect x="182" y="170" width="180" height="5" rx="2" fill="#fff" opacity="0.18" />
          <rect x="188" y="204" width="168" height="6" rx="1" fill={c.wood} />
        </g>
      );
    case "curvy":
      return (
        <g>
          <ellipse cx="272" cy="214" rx="96" ry="6" fill="#000" opacity="0.12" />
          <path d="M192 176 V146 q0 -20 22 -20 h116 q22 0 22 20 V176 Z" fill={c.sofaDark} />
          <rect x="180" y="166" width="184" height="34" rx="17" fill={c.sofa} />
          <rect x="176" y="150" width="26" height="50" rx="13" fill={c.sofaDark} />
          <rect x="342" y="150" width="26" height="50" rx="13" fill={c.sofaDark} />
          <rect x="206" y="140" width="40" height="30" rx="12" fill={c.cushion} />
          <rect x="300" y="142" width="36" height="28" rx="12" fill={c.cushion} opacity="0.85" />
          <path d="M196 200 l-6 12M348 200 l6 12" stroke={c.wood} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
    case "tufted":
      return (
        <g>
          <ellipse cx="272" cy="214" rx="100" ry="6" fill="#000" opacity="0.14" />
          <path d="M188 172 V140 q12 -12 28 -6 q14 -10 28 0 q14 -10 28 0 q14 -10 28 0 q14 -10 28 0 q16 -6 26 6 V172 Z" fill={c.sofaDark} />
          {[210, 238, 266, 294, 322].map((x) => (
            <g key={x}>
              <circle cx={x} cy="150" r="2" fill="#000" opacity="0.25" />
              <circle cx={x + 14} cy="162" r="2" fill="#000" opacity="0.25" />
            </g>
          ))}
          <rect x="180" y="168" width="184" height="32" rx="6" fill={c.sofa} />
          <ellipse cx="184" cy="168" rx="14" ry="12" fill={c.sofaDark} />
          <rect x="170" y="168" width="28" height="34" rx="4" fill={c.sofaDark} />
          <ellipse cx="360" cy="168" rx="14" ry="12" fill={c.sofaDark} />
          <rect x="346" y="168" width="28" height="34" rx="4" fill={c.sofaDark} />
          <rect x="300" y="146" width="34" height="26" rx="5" fill={c.cushion} />
          <rect x="176" y="202" width="6" height="10" fill={c.wood} />
          <rect x="362" y="202" width="6" height="10" fill={c.wood} />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx="272" cy="214" rx="98" ry="6" fill="#000" opacity="0.12" />
          <rect x="190" y="128" width="164" height="48" rx="6" fill={c.sofaDark} />
          <rect x="182" y="164" width="180" height="36" rx="6" fill={c.sofa} />
          <rect x="176" y="150" width="20" height="50" rx="5" fill={c.sofaDark} />
          <rect x="348" y="150" width="20" height="50" rx="5" fill={c.sofaDark} />
          <rect x="202" y="136" width="44" height="32" rx="6" fill={c.cushion} />
          <rect x="298" y="138" width="40" height="30" rx="6" fill={c.sofa} />
          <rect x="182" y="164" width="180" height="4" rx="2" fill="#fff" opacity="0.15" />
          <rect x="186" y="200" width="4" height="12" fill={c.metal} />
          <rect x="354" y="200" width="4" height="12" fill={c.metal} />
        </g>
      );
  }
}

function Lamp({ look }: { look: StyleLook }) {
  const c = look.colors;
  switch (look.lamp) {
    case "paper":
      return (
        <g>
          <path d="M378 212 V124" stroke={c.metal} strokeWidth="2.5" />
          <ellipse cx="378" cy="212" rx="12" ry="3" fill={c.metal} />
          <circle cx="378" cy="108" r="20" fill="#FFF7EA" />
          {[-12, -4, 4, 12].map((dy) => (
            <path key={dy} d={`M${378 - Math.sqrt(400 - dy * dy)} ${108 + dy}H${378 + Math.sqrt(400 - dy * dy)}`} stroke="#000" strokeOpacity="0.07" />
          ))}
        </g>
      );
    case "arc":
      return (
        <g>
          <ellipse cx="380" cy="210" rx="14" ry="4" fill={c.metal} />
          <path d="M380 208 V110 Q380 70 330 72 Q306 74 300 92" stroke={c.metal} strokeWidth="3" fill="none" />
          <path d="M284 104 q16 -24 32 0 Z" fill={c.metal} />
          <ellipse cx="300" cy="104" rx="10" ry="2.5" fill="#FFE9BE" />
        </g>
      );
    case "cage":
      return (
        <g>
          <path d="M378 212 V130" stroke={c.metal} strokeWidth="3" />
          <path d="M366 212 h24" stroke={c.metal} strokeWidth="4" />
          <path d="M364 96 h28 l6 30 h-40 Z" fill="none" stroke={c.metal} strokeWidth="2.5" />
          <path d="M371 96 l-3 30M378 96v30M385 96l3 30M361 111h34" stroke={c.metal} strokeWidth="1.5" />
          <circle cx="378" cy="116" r="7" fill="#FFE2A3" />
        </g>
      );
    case "dome":
      return (
        <g>
          <path d="M378 212 V112" stroke={c.metal} strokeWidth="2.5" />
          <ellipse cx="378" cy="212" rx="12" ry="3" fill={c.metal} />
          <path d="M354 112 q24 -40 48 0 Z" fill={c.wood} />
          <path d="M360 104 q18 -24 36 0M366 96 q12 -14 24 0" stroke="#000" strokeOpacity="0.15" fill="none" />
          <ellipse cx="378" cy="112" rx="24" ry="3" fill="#FFE6B8" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M378 140 L362 212M378 140 L394 212M378 140 V212" stroke={c.wood} strokeWidth="2.5" />
          <path d="M360 108 h36 l6 32 h-48 Z" fill={c.cushion === c.sofa ? "#F3EDE3" : "#F4EEE4"} />
          <path d="M354 140 h48" stroke="#000" strokeOpacity="0.1" />
        </g>
      );
  }
}
