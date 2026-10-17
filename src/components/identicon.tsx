// A small mirrored 5×5 pattern drawn from a hash of the id, so every account
// gets its own face without anyone uploading a picture.
function hashOf(seed: string) {
  // FNV-1a, spread over 40 hex digits by re-hashing with the digit index.
  let hex = "";
  for (let round = 0; hex.length < 40; round++) {
    let hash = 0x811c9dc5 ^ round;
    for (let index = 0; index < seed.length; index++) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hex += hash.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 40);
}

export function Identicon({ seed, className = "size-9" }: { seed: string; className?: string }) {
  const hex = hashOf(seed);
  const cells: boolean[] = [];
  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 5; column++) {
      const mirrored = column < 3 ? column : 4 - column;
      cells.push(parseInt(hex[row * 3 + mirrored], 16) % 2 === 0);
    }
  }
  // The last byte picks how strong the tint is, which keeps neighbours apart.
  const strength = 0.55 + (parseInt(hex.slice(-2), 16) / 255) * 0.45;

  return (
    <svg viewBox="0 0 5 5" aria-hidden className={`${className} shrink-0 rounded-lg border border-line bg-raised p-1.5`} shapeRendering="crispEdges">
      {cells.map((on, index) =>
        on ? (
          <rect key={index} x={index % 5} y={Math.floor(index / 5)} width="1" height="1" fill="var(--color-accent)" opacity={strength} />
        ) : null,
      )}
    </svg>
  );
}
