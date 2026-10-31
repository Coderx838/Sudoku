// app.js 

const $ = (s) => document.querySelector(s);

// --- crypto helpers -- //
async function sha256(bytes) {
    const view = bytes instanceof Uint8Array ? byte : new Uint8Array(bytes);
    const buf = await crypto.subtle.digest("SHA-256", view);
    return new Uint8Array(buf)
}

function hex(u8){
    return Array.from(u8)
        .map((b) => b.toString(16).padStart(2,"0"))
        .join("");
}

// -- gzip helper -- //
async function tryGzip(bytes){
    if (typeof CompressionStream === "undefined") return null;
    try {
        const stream = new Blob([bytes])
            .stream()
            .pipeThrough(new CompressionStream("gzip"));
        return new Uint8Array(await new Response(stream).arrayBuffer());

    }   catch {
        return null;
    }
}
async function tryGunzip(bytes){
    if (typeof DecompressionStream === "undefined") return null;
    try {
        const stream = new Blob([bytes])
            .stream()
            .pipeThrough(new DecompressionStream("gzip"));
        return new Uint8Array(await new Response(stream).arrayBuffer());    
    }   catch {
        return null;
    }

}

// -- grid rendering -- //

function renderGrid(grid,container){
    const wrap = document.createElement("div");
    wrap.className = "sudoku-grid";
    for (let r = 0; r <9 ; r++){
        for (let c = 0; c<9; c++){
            const  cell = document.createElement("div");
            cell.className = "cell";
            cell.textContent = grid[r][c];
            if (c % 3 === 2 && c !== 8) cell.classList.add("br");
            if (r % 3 === 2 && r !== 8) cell.classList.add("bb");
            wrap.appendChild(cell);     
        }
    }
    container.innerHTML = "";
    container.appendChild(wrap);
}

// --state --- 

let state = { grids: [], name: "", origHash: null, totaleBytes: 0};

// -- encode -- //

