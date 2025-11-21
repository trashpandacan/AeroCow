export function parseSTL(data) {
    if (typeof data === 'string') {
        return parseAsciiSTL(data);
    }
    const buffer = toArrayBuffer(data);
    if (buffer) {
        const looksAscii = bufferStartsWithSolid(buffer);
        if (looksAscii && typeof TextDecoder !== 'undefined') {
            const decoder = new TextDecoder();
            return parseAsciiSTL(decoder.decode(buffer));
        }
        const binary = parseBinarySTL(buffer);
        if (binary) {
            return binary;
        }
        if (!looksAscii && typeof TextDecoder !== 'undefined') {
            const decoder = new TextDecoder();
            return parseAsciiSTL(decoder.decode(buffer));
        }
    }
    return null;
}

function parseAsciiSTL(text) {
    const vertexRegex = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/gi;
    const vertices = [];
    let match;
    while ((match = vertexRegex.exec(text)) !== null) {
        vertices.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
    }
    if (!vertices.length) {
        return null;
    }
    return finalizeVertices(new Float32Array(vertices));
}

function parseBinarySTL(buffer) {
    if (buffer.byteLength < 84) {
        return null;
    }
    const view = new DataView(buffer);
    const triangleCount = view.getUint32(80, true);
    const expectedLength = 84 + triangleCount * 50;
    if (buffer.byteLength < expectedLength) {
        return null;
    }
    const vertices = new Float32Array(triangleCount * 9);
    let offset = 84;
    for (let i = 0; i < triangleCount; i++) {
        offset += 12; // Skip normal
        for (let v = 0; v < 9; v++) {
            vertices[i * 9 + v] = view.getFloat32(offset, true);
            offset += 4;
        }
        offset += 2; // attribute byte count
    }
    return finalizeVertices(vertices);
}

function finalizeVertices(vertices) {
    if (!vertices || vertices.length === 0) {
        return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i + 1];
        const z = vertices[i + 2];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }

    return {
        vertices,
        bounds: { minX, minY, minZ, maxX, maxY, maxZ },
    };
}

function toArrayBuffer(data) {
    if (!data) return null;
    if (data instanceof ArrayBuffer) {
        return data;
    }
    if (ArrayBuffer.isView(data)) {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer?.(data)) {
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }
    return null;
}

function bufferStartsWithSolid(buffer) {
    const view = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
    let start = 0;
    while (start < view.length && view[start] <= 32) {
        start++;
    }
    if (start + 5 > view.length) {
        return false;
    }
    const text = String.fromCharCode(
        view[start],
        view[start + 1],
        view[start + 2],
        view[start + 3],
        view[start + 4],
    ).toLowerCase();
    return text === 'solid';
}
