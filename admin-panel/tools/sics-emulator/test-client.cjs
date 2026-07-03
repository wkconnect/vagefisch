#!/usr/bin/env node
// Exercises the emulator with the exact command set vagefisch sics.ts uses + new ones.
const net = require('net');
const HOST = process.argv[2] || '127.0.0.1';
const PORT = Number(process.argv[3] || 4306);

function once(sock) {
  return new Promise((res) => {
    let buf = '';
    const on = (d) => {
      buf += d.toString();
      if (buf.includes('\n')) { sock.off('data', on); res(buf.trim()); }
    };
    sock.on('data', on);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const sock = net.connect(PORT, HOST);
  await new Promise((r) => sock.once('connect', r));
  console.log('connected; unsolicited:', await once(sock)); // I4 after connect

  const send = async (c) => { sock.write(c + '\r\n'); const r = await once(sock); console.log(String(c).padEnd(18), '=>', r); return r; };

  await send('I11');            // model
  await send('I4');             // serial
  sock.write('!set 5.230\n');   await sleep(50);  // load 5.230 kg
  await send('SI');             // immediate  -> S S 5.230 kg
  await send('S');              // stable
  await send('SIS');            // status info
  await send('T');              // tare -> tare=5.230
  await send('SI');             // net now ~0
  sock.write('!add 1.500\n');   await sleep(50);  // add product 1.5 kg
  await send('SI');             // net 1.500
  await send('TA');             // inquire tare -> 5.230
  await send('TAC');            // clear tare
  await send('SI');             // gross 6.730
  sock.write('!motion on\n');   await sleep(50);  // simulate movement
  await send('SI');             // should be dynamic 'D'
  await send('S');              // stable req during motion -> S I
  sock.write('!motion off\n');  await sleep(50);
  await send('Z');              // zero -> ZA, weight 0
  await send('D "Chicken 5kg"');// display (12 chars ok? "Chicken 5kg"=11)
  await send('D "This is way too long"'); // -> D R
  sock.write('!set 65.0\n');    await sleep(50);  // over capacity 60
  await send('SI');             // -> S + (overload)
  await send('XYZ');            // unknown -> ES
  await send('@');              // reset
  sock.end();
})();
