// Core Sudoku encoding/decoding logic
// Each grid carries 2 bytes via digit permutation of a fixed base grid.

const BASE_GRID = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

const FACT = [1,1,2,6,24,120,720,5040,40320,362880];

// nth permutation of [1..9] in lexicographic order.. (yeh)

function nthPerm(n){
    const pool = [1,2,3,4,5,6,7,8,9];
    const out = [];
    for (let i = 8; i>=0; i--){
        const f = FACT[i];
        const idx = Math.floor(n/f);
        n %= f;
        out.push(pool[idx]);
        pool.splice(idx,1);
    }
    return out;
}

// lexicographic rank of a permutation of [1..9]
function rankPerm(perm) {
  const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let rank = 0;
  for (let i = 0; i < 9; i++) {
    const idx = pool.indexOf(perm[i]);
    if (idx < 0) throw new Error("not a valid permutation");
    rank += idx * FACT[8 - i];
    pool.splice(idx, 1);
  }
  return rank;
}

function applyPerm(grid, perm){
    return grid.map((row) => row.map((d) => perm[d-1]));
}

// bytes -> array of 9x9 grids (2 byte per grid)

function encodeBytesToGrids(bytes) {
  const arr = Array.from(bytes);
  if (arr.length % 2 !== 0) arr.push(0);
  const grids = [];
  for (let i = 0; i < arr.length; i += 2) {
    const idx = (arr[i] << 8) | arr[i + 1];
    const perm = nthPerm(idx);
    grids.push(applyPerm(BASE_GRID, perm));
  }
  return grids;
}


// reverse 

function decodeGridsToBytes(grids) {
  const bytes = [];
  for (const grid of grids) {
    const perm = new Array(9).fill(0);
    const filled = new Array(9).fill(false);
    let ok = true;
    for (let r = 0; r < 9 && ok; r++) {
      for (let c = 0; c < 9 && ok; c++) {
        const bd = BASE_GRID[r][c];
        const gd = grid[r][c];
        if (!Number.isInteger(gd) || gd < 1 || gd > 9) {
          ok = false;
          break;
        }
        if (!filled[bd - 1]) {
          perm[bd - 1] = gd;
          filled[bd - 1] = true;
        } else if (perm[bd - 1] !== gd) {
          ok = false;
          break;
        }
      }
    }
    // perm must be a bijection (each grid digit used exactly once)
    if (!ok || !filled.every(Boolean) || new Set(perm).size !== 9) {
      throw new Error("Invalid grid: does not match base pattern");
    }
    const rank = rankPerm(perm);
    if (rank >= 65536) {
      throw new Error("Permutation rank " + rank + " out of range");
    }
    bytes.push((rank >> 8) & 0xff);
    bytes.push(rank & 0xff);
  }
  return bytes;
}