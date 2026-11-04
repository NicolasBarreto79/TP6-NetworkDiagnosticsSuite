/**
 * Custom ASN.1 BER (Basic Encoding Rules) Binary Codec for SNMP v1/v2c (RFC 1157 / RFC 1905).
 * Implements Tag-Length-Value (TLV) serialization and deserialization over Uint8Array
 * without external Node-specific binary dependencies so it runs natively in React Native.
 */

export const BerTag = {
  INTEGER: 0x02,
  OCTET_STRING: 0x04,
  NULL: 0x05,
  OBJECT_IDENTIFIER: 0x06,
  SEQUENCE: 0x30,
  COUNTER32: 0x41,
  GAUGE32: 0x42,
  TIMETICKS: 0x43,
  GET_REQUEST_PDU: 0xa0,
  GET_RESPONSE_PDU: 0xa2,
} as const;

export interface BerTlvNode {
  tag: number;
  length: number;
  valueBytes: Uint8Array;
  headerLength: number;
  totalByteLength: number;
}

/**
 * Encodes a BER length field (short form for 0..127, long form for >= 128).
 */
export function encodeBerLength(length: number): Uint8Array {
  if (length < 0 || !Number.isInteger(length)) {
    throw new Error(`Invalid BER length: ${length}`);
  }
  if (length < 0x80) {
    return new Uint8Array([length]);
  }
  const octets: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    octets.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return new Uint8Array([0x80 | octets.length, ...octets]);
}

/**
 * Decodes a BER length field starting at `offset`.
 */
export function decodeBerLength(
  buffer: Uint8Array,
  offset: number
): { length: number; bytesConsumed: number } {
  if (offset >= buffer.length) {
    throw new Error(`BER length decode overflow at offset ${offset}`);
  }
  const firstByte = buffer[offset];
  if ((firstByte & 0x80) === 0) {
    return { length: firstByte, bytesConsumed: 1 };
  }
  const numOctets = firstByte & 0x7f;
  if (numOctets === 0 || numOctets > 4) {
    throw new Error(`Unsupported BER length octet count: ${numOctets}`);
  }
  if (offset + 1 + numOctets > buffer.length) {
    throw new Error('BER length truncated buffer');
  }
  let length = 0;
  for (let i = 0; i < numOctets; i++) {
    length = (length << 8) | buffer[offset + 1 + i];
  }
  return { length, bytesConsumed: 1 + numOctets };
}

/**
 * Wraps value bytes into a complete TLV (Tag-Length-Value) Uint8Array.
 */
export function encodeBerTlv(tag: number, valueBytes: Uint8Array): Uint8Array {
  const lenBytes = encodeBerLength(valueBytes.length);
  const out = new Uint8Array(1 + lenBytes.length + valueBytes.length);
  out[0] = tag;
  out.set(lenBytes, 1);
  out.set(valueBytes, 1 + lenBytes.length);
  return out;
}

/**
 * Reads a single BER TLV node starting at `offset`.
 */
export function decodeBerTlv(buffer: Uint8Array, offset = 0): BerTlvNode {
  if (offset >= buffer.length) {
    throw new Error(`Cannot decode BER TLV at offset ${offset} (buffer length ${buffer.length})`);
  }
  const tag = buffer[offset];
  const { length, bytesConsumed } = decodeBerLength(buffer, offset + 1);
  const headerLength = 1 + bytesConsumed;
  const endOffset = offset + headerLength + length;
  if (endOffset > buffer.length) {
    throw new Error(
      `BER TLV value exceeds buffer bounds: needed ${endOffset}, got ${buffer.length}`
    );
  }
  return {
    tag,
    length,
    valueBytes: buffer.subarray(offset + headerLength, endOffset),
    headerLength,
    totalByteLength: headerLength + length,
  };
}

/**
 * Decodes a sequence of sibling BER TLV children contained inside a constructed TLV.
 */
export function decodeBerSequenceChildren(sequenceBytes: Uint8Array): BerTlvNode[] {
  const children: BerTlvNode[] = [];
  let cursor = 0;
  while (cursor < sequenceBytes.length) {
    const node = decodeBerTlv(sequenceBytes, cursor);
    children.push(node);
    cursor += node.totalByteLength;
  }
  return children;
}

/**
 * Concatenates multiple Uint8Array chunks into a single Uint8Array.
 */
export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Encodes a signed 32-bit integer (ASN.1 INTEGER, tag 0x02).
 */
export function encodeBerInteger(value: number, tag: number = BerTag.INTEGER): Uint8Array {
  let intVal = Math.trunc(value);
  if (intVal === 0) {
    return encodeBerTlv(tag, new Uint8Array([0]));
  }
  const bytes: number[] = [];
  if (intVal > 0) {
    while (intVal > 0) {
      bytes.unshift(intVal & 0xff);
      intVal = Math.floor(intVal / 256);
    }
    if ((bytes[0] & 0x80) !== 0) {
      bytes.unshift(0x00);
    }
  } else {
    let temp = intVal;
    while (temp < -1 || (temp === -1 && bytes.length === 0)) {
      bytes.unshift(temp & 0xff);
      temp = Math.floor(temp / 256);
      if (bytes.length >= 4) break;
    }
  }
  return encodeBerTlv(tag, new Uint8Array(bytes));
}

/**
 * Encodes an unsigned 32-bit counter/gauge/timeticks (0x41, 0x42, 0x43).
 */
export function encodeBerUnsigned32(value: number, tag: number): Uint8Array {
  const unsigned = Math.max(0, Math.trunc(value)) >>> 0;
  return encodeBerInteger(unsigned, tag);
}

/**
 * Decodes an ASN.1 INTEGER or unsigned Counter32/Gauge32/TimeTicks from its value bytes.
 */
export function decodeBerIntegerValue(valueBytes: Uint8Array, unsigned = false): number {
  if (valueBytes.length === 0) return 0;
  let result = !unsigned && (valueBytes[0] & 0x80) !== 0 ? -1 : 0;
  for (let i = 0; i < valueBytes.length; i++) {
    result = result * 256 + valueBytes[i];
  }
  return result;
}

/**
 * Encodes a UTF-8 string or raw bytes as an ASN.1 OCTET STRING (0x04).
 */
export function encodeBerOctetString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  return encodeBerTlv(BerTag.OCTET_STRING, encoder.encode(str));
}

/**
 * Encodes raw bytes (such as a 6-byte MAC address) as an ASN.1 OCTET STRING (0x04).
 */
export function encodeBerRawOctetString(bytes: Uint8Array): Uint8Array {
  return encodeBerTlv(BerTag.OCTET_STRING, bytes);
}

/**
 * Decodes an ASN.1 OCTET STRING as UTF-8 text, or as a colon-separated MAC hex string
 * if it is a 6-byte binary hardware address.
 */
export function decodeBerOctetStringValue(valueBytes: Uint8Array): string {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(valueBytes);
}

/**
 * Formats a 6-octet binary buffer as a standard MAC address (e.g., "DC:2C:6E:4A:11:09").
 */
export function formatMacBytes(valueBytes: Uint8Array): string {
  if (valueBytes.length === 6) {
    return Array.from(valueBytes)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(':');
  }
  return decodeBerOctetStringValue(valueBytes);
}

/**
 * Parses a MAC string ("DC:2C:6E:4A:11:09") into a 6-byte Uint8Array for `ifPhysAddress`.
 */
export function macStringToBytes(mac: string): Uint8Array {
  const parts = mac.split(/[:-]/).filter(Boolean);
  if (parts.length !== 6) {
    return new Uint8Array([0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e]);
  }
  return new Uint8Array(parts.map((hex) => parseInt(hex, 16) & 0xff));
}

/**
 * Encodes an ASN.1 NULL (0x05 0x00).
 */
export function encodeBerNull(): Uint8Array {
  return new Uint8Array([BerTag.NULL, 0x00]);
}

/**
 * Encodes an ASN.1 OBJECT IDENTIFIER (0x06) from dotted string notation (e.g. "1.3.6.1.2.1.1.5.0").
 * Follows ITU-T X.690 section 8.19:
 * - First two arcs compressed as (arc0 * 40 + arc1)
 * - Subsequent arcs encoded in base-128 big-endian with bit 7 set on all but the last octet.
 */
export function encodeBerOid(oidString: string): Uint8Array {
  const arcs = oidString
    .trim()
    .replace(/^\./, '')
    .split('.')
    .map((part) => {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`Invalid OID arc "${part}" in OID "${oidString}"`);
      }
      return n;
    });

  if (arcs.length < 2) {
    throw new Error(`OID must contain at least 2 arcs: "${oidString}"`);
  }

  const out: number[] = [arcs[0] * 40 + arcs[1]];

  for (let i = 2; i < arcs.length; i++) {
    let arc = arcs[i];
    if (arc < 128) {
      out.push(arc);
    } else {
      const subOctets: number[] = [arc & 0x7f];
      arc = Math.floor(arc / 128);
      while (arc > 0) {
        subOctets.unshift((arc & 0x7f) | 0x80);
        arc = Math.floor(arc / 128);
      }
      out.push(...subOctets);
    }
  }

  return encodeBerTlv(BerTag.OBJECT_IDENTIFIER, new Uint8Array(out));
}

/**
 * Decodes an ASN.1 OBJECT IDENTIFIER value buffer back into dotted string notation.
 */
export function decodeBerOidValue(valueBytes: Uint8Array): string {
  if (valueBytes.length === 0) {
    throw new Error('Empty OID value buffer');
  }
  const first = valueBytes[0];
  const arc0 = first < 80 ? Math.floor(first / 40) : 2;
  const arc1 = first - arc0 * 40;
  const arcs: number[] = [arc0, arc1];

  let current = 0;
  for (let i = 1; i < valueBytes.length; i++) {
    const byte = valueBytes[i];
    current = current * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      arcs.push(current);
      current = 0;
    }
  }
  return arcs.join('.');
}

/**
 * Converts a Uint8Array buffer into a space-separated uppercase hexadecimal string
 * for protocol inspection in the mobile diagnostic console.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

