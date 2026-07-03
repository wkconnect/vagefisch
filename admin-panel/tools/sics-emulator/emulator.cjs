#!/usr/bin/env node
/**
 * MT-SICS Scale Emulator (virtual scale) for Mettler Toledo ICS4__/ICS6__.
 * Reference: MT-SICS manual 22019673C.
 *
 * Emulates an ICS689 well enough to develop/test the vagefisch connector
 * (server/drivers/sics.ts) WITHOUT physical hardware or VPN into the client LAN.
 *
 * Usage:
 *   node emulator.js [--port 4306] [--host 0.0.0.0] [--serial 1234567]
 *                    [--model ICS689] [--weight 0.000] [--unit kg]
 *
 * Runtime control (over the SAME TCP socket, non-SICS, prefixed with '!'):
 *   !set <kg>       set current gross weight, mark stable      e.g.  !set 5.230
 *   !add <kg>       add to current weight (simulate loading)   e.g.  !add 1.5
 *   !motion on|off  toggle stability (motion => dynamic 'D')
 *   !state          print internal state
 *
 * SICS supported: I0 I1 I2 I3 I4 I11 | S SI SIR | Z ZI | T TA TAC TI | SIS | D DW | @
 */
'use strict';
const net = require('net');

// ---- CLI args -------------------------------------------------------------
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PORT = Number(arg('port', 4306));
const HOST = arg('host', '0.0.0.0');
const SERIAL = arg('serial', '1234567');
const MODEL = arg('model', 'ICS689');

// ---- Scale state ----------------------------------------------------------
const scale = {
  gross: parseFloat(arg('weight', '0.000')),
  tare: 0,
  unit: arg('unit', 'kg'),
  stable: true,
  decimals: 3,
  capacity: 60.0, // ICS689: 60 kg
};
const net_ = () => scale.gross - scale.tare;

// Weight field: 10 chars, right-aligned, per manual 2.2.1
const fmtW = (v) => v.toFixed(scale.decimals).padStart(10, ' ');
const CRLF = '\r\n';

// ---- SICS command handler -------------------------------------------------
function handle(line) {
  const cmd = line.trim();
  const U = cmd.toUpperCase();

  // Identification (Level 0/3)
  if (U === 'I0') return `I0 B x` + CRLF; // simplified command list ack
  if (U === 'I1') return `I1 A "0123" "2.30" "2.20" "1.00" "1.00"` + CRLF;
  if (U === 'I2') return `I2 A "${MODEL}MF ${scale.capacity.toFixed(2)}${scale.unit}"` + CRLF;
  if (U === 'I3') return `I3 A "S6-DC-01.01.00-MF-8"` + CRLF;
  if (U === 'I4') return `I4 A "${SERIAL}"` + CRLF;
  if (U === 'I11') return `I11 A "${MODEL}a-BB60/x"` + CRLF;

  const status = scale.stable ? 'S' : 'D';
  // Over/underload only affects weight-read commands (S / SI / SIR)
  const overload = () => scale.gross > scale.capacity;
  const underload = () => net_() < -0.0001;

  // Weight (Level 0)
  if (U === 'S') {
    if (overload()) return `S +` + CRLF;
    if (underload()) return `S -` + CRLF;
    if (!scale.stable) return `S I` + CRLF; // motion -> not executable (manual 4.2.6)
    return `S S ${fmtW(net_())} ${scale.unit}` + CRLF;
  }
  if (U === 'SI') {
    if (overload()) return `S +` + CRLF;
    if (underload()) return `S -` + CRLF;
    return `S ${status} ${fmtW(net_())} ${scale.unit}` + CRLF;
  }
  if (U === 'SIR') {
    if (overload()) return `S +` + CRLF;
    return `S ${status} ${fmtW(net_())} ${scale.unit}` + CRLF;
  }

  // Zero (Level 0)
  if (U === 'Z') {
    if (!scale.stable) return `Z I` + CRLF;
    scale.tare = 0; scale.gross = 0; return `Z A` + CRLF;
  }
  if (U === 'ZI') { scale.tare = 0; scale.gross = 0; return `ZI ${status}` + CRLF; }

  // Tare (Level 1)
  if (U === 'T') {
    if (!scale.stable) return `T I` + CRLF;
    scale.tare = scale.gross; return `T S ${fmtW(scale.tare)} ${scale.unit}` + CRLF;
  }
  if (U === 'TI') { scale.tare = scale.gross; return `TI ${status} ${fmtW(scale.tare)} ${scale.unit}` + CRLF; }
  if (U === 'TAC') { scale.tare = 0; return `TAC A` + CRLF; }
  if (U.startsWith('TA')) {
    // "TA" inquiry vs "TA <val> <unit>" preset
    const parts = cmd.split(/\s+/);
    if (parts.length >= 2 && !isNaN(parseFloat(parts[1]))) {
      scale.tare = parseFloat(parts[1]);
      return `TA A ${fmtW(scale.tare)} ${scale.unit}` + CRLF;
    }
    return `TA A ${fmtW(scale.tare)} ${scale.unit}` + CRLF; // inquiry
  }

  // Net info with status (Level 2)  -> SIS A <status> "value" unit dec step app info
  if (U === 'SIS') {
    const st = scale.stable ? 0 : 1;
    return `SIS A ${st} "${net_().toFixed(scale.decimals)}" 1 ${scale.decimals} 1 0 ${scale.tare > 0 ? 1 : 0}` + CRLF;
  }

  // Display (Level 1)
  if (U === 'DW') return `DW A` + CRLF;
  if (U.startsWith('D ') || U === 'D') {
    const m = cmd.match(/"([^"]*)"/);
    const text = m ? m[1] : '';
    if (text.length > 12) return `D R` + CRLF; // ICS689: 12 chars, cut off
    process.stdout.write(`  [scale display] "${text}"\n`);
    return `D A` + CRLF;
  }

  // Reset
  if (U === '@') { scale.tare = 0; scale.gross = 0; scale.stable = true; return `I4 A "${SERIAL}"` + CRLF; }

  // Unknown command
  return `ES` + CRLF; // syntax error
}

// ---- Non-SICS admin control ('!') ----------------------------------------
function control(line, sock) {
  const [c, v] = line.trim().slice(1).split(/\s+/);
  if (c === 'set') { scale.gross = parseFloat(v) || 0; scale.stable = true; }
  else if (c === 'add') { scale.gross += parseFloat(v) || 0; scale.stable = true; }
  else if (c === 'motion') scale.stable = (v !== 'on');
  else if (c === 'state') { /* fallthrough print */ }
  else { sock.write(`!ERR unknown control\n`); return; }
  sock.write(`!OK gross=${scale.gross} tare=${scale.tare} net=${net_()} stable=${scale.stable}\n`);
}

// ---- TCP server -----------------------------------------------------------
const server = net.createServer((sock) => {
  const peer = `${sock.remoteAddress}:${sock.remotePort}`;
  process.stdout.write(`+ connect ${peer}\n`);
  sock.write(`I4 A "${SERIAL}"${CRLF}`); // unsolicited serial after connect (manual 2.5)
  let buf = '';
  sock.on('data', (d) => {
    buf += d.toString('binary');
    let idx;
    while ((idx = buf.search(/\r\n|\n/)) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + (buf[idx] === '\r' ? 2 : 1));
      if (!line.trim()) continue;
      if (line.trim().startsWith('!')) { control(line, sock); continue; }
      const resp = handle(line);
      process.stdout.write(`  <- ${line.trim().padEnd(16)} -> ${resp.trim()}\n`);
      sock.write(resp);
    }
  });
  sock.on('close', () => process.stdout.write(`- close ${peer}\n`));
  sock.on('error', () => {});
});
server.listen(PORT, HOST, () => {
  process.stdout.write(`MT-SICS emulator (${MODEL}, S/N ${SERIAL}) listening on ${HOST}:${PORT}\n`);
  process.stdout.write(`Control over socket: !set <kg> | !add <kg> | !motion on|off | !state\n`);
});
