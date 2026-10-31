// Header pack/unpack: MAGIC | name_len(1) | data_len(4) | hash8(8) | name | data
// Helper 

const MAGIC = [0x57, 0x53, 0x54, 0x52]; // "WSTR"

function packHeader(name, dataLen , hash8){
    const nameBytes = new TextEncoder().encode(name);
    if (nameBytes.length > 255) throw new Error("Filename too long");
    const header = [];
    header.push(...MAGIC);
    header.push(nameBytes.length);
    header.push((dataLen >>> 24) & 0xff);
    header.push((dataLen >>> 16) & 0xff);
    header.push((dataLen >>> 8) & 0xff);
    header.push(dataLen & 0xff);
    header.push(...hash8);
    header.push(...nameBytes);
    return header;    
}

function unpackHeader(bytes) {
  if (bytes.length < 17) throw new Error("Data too short");
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error("Not a Sudoku Cipher file");
  }
  const nameLen = bytes[4];
  const dataLen =
    bytes[5] * 0x1000000 + (bytes[6] << 16) + (bytes[7] << 8) + bytes[8];
  const hash8 = bytes.slice(9, 17);
  if (bytes.length < 17 + nameLen + dataLen)
    throw new Error("Data truncated");
  const name = new TextDecoder().decode(
    new Uint8Array(bytes.slice(17, 17 + nameLen))
  );
  const data = bytes.slice(17 + nameLen, 17 + nameLen + dataLen);
  return { name, data, hash8 };
}
