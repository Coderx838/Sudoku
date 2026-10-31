// app.js 

const $ = (s) => document.querySelector(s);

// --- crypto helpers -- //
async function sha256(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
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

let state = { grids: [], name: "", origHash: null, totalBytes: 0};

// -- encode -- //

async function doEncode(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const origHash = await sha256(bytes);
  const hash8 = origHash.slice(0, 8);
  const compressed = await tryGzip(bytes);
  const payload = compressed && compressed.length < bytes.length ? compressed : bytes;
  const header = packHeader(file.name, payload.length, hash8);
  const total = new Uint8Array(header.length + payload.length);
  total.set(header);
  total.set(payload, header.length);
  const grids = encodeBytesToGrids(total);
  state = {
    grids,
    name: file.name,
    origHash,
    totalBytes: bytes.length,
  };
  showEncodeResult(file.name, bytes.length, grids.length, origHash);
  showPreview(0);
}

function showEncodeResult(name, size, numGrids, hash) {
  const el = $("#encode-result");
  el.classList.remove("hidden");
  el.innerHTML = `
    <div class="stat-row"><span class="label">file</span><span class="value">${esc(name)}</span></div>
    <div class="stat-row"><span class="label">size</span><span class="value">${size} bytes</span></div>
    <div class="stat-row"><span class="label">grids</span><span class="value">${numGrids} Sudoku${numGrids > 1 ? "s" : ""}</span></div>
    <div class="stat-row"><span class="label">sha-256</span><span class="value mono">${hex(hash).slice(0, 32)}…</span></div>
    <button class="btn" id="dl-grids">download grids (.json)</button>
  `;
  $("#dl-grids").onclick = downloadGrids;
}

function downloadGrids(){
    const payload = JSON.stringify({
        format : 'sudoku-cipher-v1',
        name : state.name,
        grids: state.grids,
    })

    const blob = new Blob([payload], { type: "application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.name + ".grids.json";
    a.click();

}

// --- decode ---
async function doDecode(json) {
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("Could not parse JSON");
  }
  if (!obj.grids || !Array.isArray(obj.grids))
    throw new Error("Missing grids array");
  const bytes = decodeGridsToBytes(obj.grids);
  const { name, data, hash8 } = unpackHeader(bytes);
  // hash decides: raw payload matches => stored uncompressed, else try gzip
  let original = new Uint8Array(data);  // convert to binary or this is gonna destroy all things..
  const rawHash = await sha256(original); // hash 
  if (hex(rawHash.slice(0, 8)) !== hex(hash8)) {
    const maybe = await tryGunzip(original); // use original instead of raw data.
    if (maybe) original = maybe;
  }
  const origHash = await sha256(original);
  const match = hex(origHash.slice(0, 8)) === hex(hash8);
  showDecodeResult(name, original.length, origHash, match, original);
}

function showDecodeResult(name, size, hash, match, data) {
  const el = $("#decode-result");
  el.classList.remove("hidden");
  const status = match
    ? '<span class="ok">✓ hash verified</span>'
    : '<span class="bad">✗ hash mismatch</span>';
  el.innerHTML = `
    <div class="stat-row"><span class="label">file</span><span class="value">${esc(name)}</span></div>
    <div class="stat-row"><span class="label">size</span><span class="value">${size} bytes</span></div>
    <div class="stat-row"><span class="label">sha-256</span><span class="value mono">${hex(hash).slice(0, 32)}…</span></div>
    <div class="stat-row"><span class="label">status</span><span class="value">${status}</span></div>
    <button class="btn" id="dl-file">download recovered file</button>
  `;
  $("#dl-file").onclick = () => {
    const blob = new Blob([data]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  };
}


// -- preview -- //
function showPreview(i) {
  const g = state.grids[i];
  if (!g) return;
  renderGrid(g, $("#grid-canvas"));
  $("#grid-pos").textContent = `${i + 1} / ${state.grids.length}`;
  $("#prev-btn").disabled = i <= 0;
  $("#next-btn").disabled = i >= state.grids.length - 1;
}


// --- helpers --- //
function esc(s){
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

// -- wiring --- //

function wireDrop(zoneSel, inputSel, handler) {
  const zone = $(zoneSel);
  const input = $(inputSel);
  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    if (input.files[0]) handler(input.files[0]);
    input.value = "";
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag");
    if (e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]);
  });
}

wireDrop("#encode-drop", "#encode-input", async (f) => {
  try {
    await doEncode(f);
    $("#preview-panel").classList.remove("hidden");
  } catch (err) {
    alert("Encode error: " + err.message);
  }
});

wireDrop("#decode-drop", "#decode-input", async (f) => {
  try {
    await doDecode(await f.text());
  } catch (err) {
    alert("Decode error: " + err.message);
  }
});

$("#prev-btn").onclick = () => {
  const pos = parseInt($("#grid-pos").textContent) - 2;
  if (pos >= 0) showPreview(pos);
};
$("#next-btn").onclick = () => {
  const pos = parseInt($("#grid-pos").textContent);
  if (pos < state.grids.length) showPreview(pos);
};

// sample file button //

$("#sample-btn").onclick = async () => {
    const text = "Hello from Sudoku!\nThis file is hidden inside valid Sudoku grids.o(〃＾▽＾〃)o.\n";
    const file = new File([text], "hello.txt", {type: "text/plain"});
    try {
        await doEncode(file);
        $("#preview-panel").classList.remove("hidden");

    }   catch(err){
        alert(err.message);
    } 
};
