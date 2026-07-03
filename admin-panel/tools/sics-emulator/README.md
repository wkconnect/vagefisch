# MT-SICS Scale Emulator (virtual ICS689)

Emulates a Mettler Toledo **ICS4__/ICS6__** scale (MT-SICS over TCP) so the
vagefisch connector (`server/drivers/sics.ts`) can be developed and tested
**without physical hardware and without VPN** into the client LAN.

Reference: MT-SICS manual **22019673C**. Real device: `Waage-1` @ `192.168.1.63:4306`.

## Run

```bash
node emulator.cjs --port 4306 --model ICS689 --serial 7654321
# options: --host 0.0.0.0 --weight 0.000 --unit kg --capacity implied 60kg
```

Point the connector / admin panel at `127.0.0.1:4306` (or the LAN IP of the dev
machine) instead of the real scale.

## Runtime control (over the same TCP socket, non-SICS, `!`-prefixed)

```
!set <kg>       set gross weight, mark stable      !set 5.230
!add <kg>       add to weight (simulate loading)    !add 1.5
!motion on|off  toggle stability (motion => 'D')
!state          print internal state
```

## SICS commands implemented

| Group | Commands |
|-------|----------|
| Identification | `I0 I1 I2 I3 I4 I11` |
| Weight | `S` `SI` `SIR` |
| Zero  | `Z` `ZI` |
| Tare  | `T` `TI` `TA` (inquiry/preset) `TAC` |
| Status | `SIS` (weight + stability + over/underload) |
| Display | `D "text"` (12-char ICS689 limit → `DR` if longer) `DW` |
| Reset | `@` |
| Errors | overload `S +`, underload `S -`, motion `S I`, syntax `ES` |

## Test client

```bash
node test-client.cjs 127.0.0.1 4306
```

Runs the exact command set the vagefisch driver uses (`SI/S/Z/T/…`) plus the
new `TA/TAC/SIS/SIR`, driving the weight via the `!` control channel. Expected
output shows correct weight/tare/status/display/overload behaviour.

## Files

- `emulator.cjs` — the virtual scale (Node built-in `net`, no deps).
- `test-client.cjs` — automated SICS test sequence.
- `sics.additions.patch` — unified diff adding `presetTare/clearTare/sendNetInfo/streamWeights`
  (+ `setTare` alias and `sendCommand` export that fix a latent `queue-worker.ts` crash)
  to `server/drivers/sics.ts`. Apply with `git apply` from the repo root, then `pnpm check`.
