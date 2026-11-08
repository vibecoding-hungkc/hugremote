/**
 * Minimal pure-TypeScript QR Code SVG generator (ISO/IEC 18004, Byte Mode, ECC Level L, Versions 1..10).
 * Zero external dependencies — specifically designed for rendering otpauth:// TOTP URIs cleanly as SVG.
 */

interface VersionSpec {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  numBlocks: number;
  alignmentCenters: number[];
}

// Version 1..10 ECC Level L specifications (supports up to 271 bytes)
const VERSION_SPECS_L: VersionSpec[] = [
  { version: 1, totalCodewords: 26, ecCodewordsPerBlock: 7, numBlocks: 1, alignmentCenters: [] },
  { version: 2, totalCodewords: 44, ecCodewordsPerBlock: 10, numBlocks: 1, alignmentCenters: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewordsPerBlock: 15, numBlocks: 1, alignmentCenters: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewordsPerBlock: 20, numBlocks: 1, alignmentCenters: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewordsPerBlock: 26, numBlocks: 1, alignmentCenters: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewordsPerBlock: 18, numBlocks: 2, alignmentCenters: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewordsPerBlock: 20, numBlocks: 2, alignmentCenters: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewordsPerBlock: 24, numBlocks: 2, alignmentCenters: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewordsPerBlock: 30, numBlocks: 2, alignmentCenters: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewordsPerBlock: 18, numBlocks: 4, alignmentCenters: [6, 28, 50] },
];

// GF(256) log/exp tables with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    for (let j = 0; j < ecLen - 1; j++) {
      rem[j] = rem[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    rem[ecLen - 1] = gfMul(gen[ecLen], factor);
  }
  return rem;
}

function pickVersion(byteLength: number): VersionSpec {
  for (const spec of VERSION_SPECS_L) {
    const dataCodewords = spec.totalCodewords - spec.ecCodewordsPerBlock * spec.numBlocks;
    const headerBits = 4 + (spec.version <= 9 ? 8 : 16);
    const maxBytes = Math.floor((dataCodewords * 8 - headerBits) / 8);
    if (byteLength <= maxBytes) return spec;
  }
  throw new Error('QR payload exceeds supported Version 10 capacity');
}

function encodeDataCodewords(payloadBytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const totalDataCodewords = spec.totalCodewords - spec.ecCodewordsPerBlock * spec.numBlocks;
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator = 0100
  pushBits(0b0100, 4);
  pushBits(payloadBytes.length, spec.version <= 9 ? 8 : 16);
  for (let i = 0; i < payloadBytes.length; i++) {
    pushBits(payloadBytes[i], 8);
  }

  const maxBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(totalDataCodewords);
  const byteLen = bits.length / 8;
  for (let i = 0; i < byteLen; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i * 8 + j];
    }
    codewords[i] = b;
  }

  const padBytes = [0xec, 0x11];
  for (let i = byteLen; i < totalDataCodewords; i++) {
    codewords[i] = padBytes[(i - byteLen) % 2];
  }

  // Split into blocks and interleave
  const numBlocks = spec.numBlocks;
  const totalData = totalDataCodewords;
  const shortBlockLen = Math.floor(totalData / numBlocks);
  const numLongBlocks = totalData % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;

  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = b < numShortBlocks ? shortBlockLen : shortBlockLen + 1;
    const block = codewords.subarray(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(rsComputeRemainder(block, spec.ecCodewordsPerBlock));
  }

  const result = new Uint8Array(spec.totalCodewords);
  let outIdx = 0;
  const maxDataBlockLen = numLongBlocks > 0 ? shortBlockLen + 1 : shortBlockLen;
  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        result[outIdx++] = dataBlocks[b][i];
      }
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      result[outIdx++] = ecBlocks[b][i];
    }
  }
  return result;
}

function buildMatrix(codewords: Uint8Array, spec: VersionSpec): boolean[][] {
  const size = spec.version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark;
    isFunction[r][c] = true;
  };

  // Finder patterns + separators
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setFunctionModule(r, c, inOuter && (onBorder || inCore));
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunctionModule(cr + dr, cc + dc, dark);
        }
      }
    }
  }

  // Reserve format info areas & dark module
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }
  setFunctionModule(size - 8, 8, true);

  // Place data bits in zig-zag
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = rightCol - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          // Apply Mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // Write Format Information for ECC Level L (01) + Mask 0 (000) -> precomputed BCH & XOR mask = 0x77c4
  const formatBits = 0x77c4;
  const getFormatBit = (idx: number) => ((formatBits >>> idx) & 1) === 1;
  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, getFormatBit(i));
  setFunctionModule(8, 7, getFormatBit(6));
  setFunctionModule(8, 8, getFormatBit(7));
  setFunctionModule(7, 8, getFormatBit(8));
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, getFormatBit(i));

  for (let i = 0; i < 8; i++) setFunctionModule(8, size - 1 - i, getFormatBit(i));
  for (let i = 8; i < 15; i++) setFunctionModule(size - 15 + i, 8, getFormatBit(i));

  return modules;
}

export function generateQrSvg(text: string, margin = 2): string {
  const payload = Buffer.from(text, 'utf8');
  const spec = pickVersion(payload.length);
  const codewords = encodeDataCodewords(payload, spec);
  const matrix = buildMatrix(codewords, spec);
  const size = matrix.length;
  const totalSize = size + margin * 2;

  const paths: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        paths.push(`M${c + margin},${r + margin}h1v1h-1z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges"><rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/><path d="${paths.join('')}" fill="#111111"/></svg>`;
}
