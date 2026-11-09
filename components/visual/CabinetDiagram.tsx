/** Isometrische kast met maatlijnen en losse planken: beeld voor "Zelf maken". */
export function CabinetDiagram({ className, wood = "#D9BC93", line = "#2A2520" }: { className?: string; wood?: string; line?: string }) {
  // isometrische projectie
  const P = (x: number, y: number, z: number) => [200 + (x - z) * 0.866, 150 + (x + z) * 0.5 - y] as const;
  const poly = (pts: (readonly [number, number])[]) => pts.map((p) => p.join(",")).join(" ");
  const W = 90,
    D = 40,
    H = 170;
  const shelves = [0, 42, 84, 126];

  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label="Bouwtekening van een kast">
      <defs>
        <pattern id="cab-grain" width="8" height="40" patternUnits="userSpaceOnUse">
          <path d="M2 0 q2 20 0 40M6 0 q-2 20 0 40" stroke="#000" strokeOpacity="0.06" fill="none" />
        </pattern>
      </defs>
      {/* schaduw */}
      <polygon points={poly([P(-6, 0, -6), P(W + 6, 0, -6), P(W + 6, 0, D + 6), P(-6, 0, D + 6)])} fill="#000" opacity="0.07" transform="translate(-30 72)" />

      <g transform="translate(-30 72)" strokeLinejoin="round">
        {/* achterwand */}
        <polygon points={poly([P(0, 0, 0), P(W, 0, 0), P(W, H, 0), P(0, H, 0)])} fill={wood} stroke={line} strokeWidth="1.4" />
        <polygon points={poly([P(0, 0, 0), P(W, 0, 0), P(W, H, 0), P(0, H, 0)])} fill="#000" opacity="0.12" />
        {/* linkerzijwand */}
        <polygon points={poly([P(0, 0, 0), P(0, 0, D), P(0, H, D), P(0, H, 0)])} fill={wood} stroke={line} strokeWidth="1.4" />
        <polygon points={poly([P(0, 0, 0), P(0, 0, D), P(0, H, D), P(0, H, 0)])} fill="url(#cab-grain)" />
        {/* planken */}
        {shelves.map((y) => (
          <g key={y}>
            <polygon points={poly([P(0, y, 0), P(W, y, 0), P(W, y, D), P(0, y, D)])} fill="#fff" fillOpacity="0.55" stroke={line} strokeWidth="1.2" />
            <polygon points={poly([P(0, y, D), P(W, y, D), P(W, y - 3, D), P(0, y - 3, D)])} fill={wood} stroke={line} strokeWidth="1" />
          </g>
        ))}
        {/* boeken en vaas */}
        {[8, 16, 23, 31].map((x, i) => {
          const h = [30, 34, 26, 32][i];
          return <polygon key={x} points={poly([P(x, 42, 10), P(x + 6, 42, 10), P(x + 6, 42 + h, 10), P(x, 42 + h, 10)])} fill={["#A4593B", "#5F6B4E", "#E0B57C", "#2A2520"][i]} opacity="0.9" />;
        })}
        <polygon points={poly([P(58, 84, 18), P(70, 84, 18), P(68, 106, 18), P(60, 106, 18)])} fill="#C9B79C" stroke={line} strokeWidth="1" />
        {/* top */}
        <polygon points={poly([P(0, H, 0), P(W, H, 0), P(W, H, D), P(0, H, D)])} fill={wood} stroke={line} strokeWidth="1.4" />
        {/* rechterzijwand die "loskomt" (explode) */}
        <g transform="translate(34 -10)">
          <polygon points={poly([P(W, 0, 0), P(W, 0, D), P(W, H, D), P(W, H, 0)])} fill={wood} stroke={line} strokeWidth="1.4" />
          <polygon points={poly([P(W, 0, 0), P(W, 0, D), P(W, H, D), P(W, H, 0)])} fill="url(#cab-grain)" />
          {shelves.slice(1).map((y) => {
            const [x1, y1] = P(W, y - 1.5, D * 0.3);
            const [x2, y2] = P(W, y - 1.5, D * 0.7);
            return (
              <g key={y}>
                <circle cx={x1} cy={y1} r="2" fill={line} />
                <circle cx={x2} cy={y2} r="2" fill={line} />
              </g>
            );
          })}
        </g>
        {/* beweging-pijl */}
        {(() => {
          const [ax, ay] = P(W + 4, H / 2, D / 2);
          return <path d={`M${ax} ${ay} l26 -8 m-8 -4 l8 4 l-6 7`} stroke="#A4593B" strokeWidth="2" fill="none" strokeLinecap="round" />;
        })()}
        {/* maatlijnen */}
        {(() => {
          const [h1x, h1y] = P(-8, 0, D + 8);
          const [h2x, h2y] = P(-8, H, D + 8);
          const [w1x, w1y] = P(0, -10, D + 10);
          const [w2x, w2y] = P(W, -10, D + 10);
          return (
            <g stroke="#9A8F84" strokeWidth="1" fill="#9A8F84" fontSize="11" fontFamily="Inter, sans-serif">
              <path d={`M${h1x} ${h1y}L${h2x} ${h2y}`} />
              <path d={`M${h1x - 4} ${h1y}h8M${h2x - 4} ${h2y}h8`} />
              <text x={h1x - 10} y={(h1y + h2y) / 2} textAnchor="end" stroke="none">
                200
              </text>
              <path d={`M${w1x} ${w1y}L${w2x} ${w2y}`} />
              <text x={(w1x + w2x) / 2 + 4} y={(w1y + w2y) / 2 + 16} stroke="none">
                100
              </text>
            </g>
          );
        })()}
      </g>
    </svg>
  );
}
