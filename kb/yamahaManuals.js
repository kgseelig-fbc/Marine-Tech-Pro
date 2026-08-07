// js/yamahaManuals.js
//
// Yamaha factory service manual reference corpus.
// Compiled from:
//   - Yamaha F115C / LF115C (68V-28197-1F-11, 1st ed. Oct 2003)
//   - Yamaha F150TR / LF150TR (63P1F11)
//   - Yamaha F200TR / LF200TR / F225TR / LF225TR (69J1D11)
//
// This file is loaded at server startup into the Ask-a-Tech AI
// system prompt (cache_control: ephemeral) so the assistant can
// ground answers in factory specs for these platforms.
//
// It's a JS string on window.yamahaManualReference so it is
// served under the same auth as the other KB files and can
// optionally be rendered client-side in the future.

window.yamahaManualReference = `
================================================================
YAMAHA 4-STROKE OUTBOARD — FACTORY SERVICE MANUAL REFERENCE
Condensed for field techs. Always verify against the primary ID
tag / HIN for your specific engine — Yamaha periodically updates
service limits.
================================================================

----------------------------------------------------------------
1. GENERAL SPECIFICATIONS
----------------------------------------------------------------

F115C / LF115C (manual 68V-28197-1F-11)
  - Type: In-line 4-stroke, DOHC, 16 valves
  - Cylinders: 4
  - Displacement: 1,741 cm³ (106.2 cu. in.)
  - Bore × stroke: 79.0 × 88.8 mm (3.11 × 3.50 in)
  - Compression ratio: 9.7
  - Max output: 84.6 kW (115 hp) @ 5,500 r/min
  - Full throttle range: 5,000–6,000 r/min
  - Max fuel consumption: 38 L/hr (10.0 US gal/hr) @ 6,000 r/min
  - Fuel system: Electronic fuel injection
  - Ignition system: TCI (Transistor Controlled Ignition)
  - Starting: Electric
  - Alternator: 12V, 25A
  - Spark plug: NGK LFR6A-11
  - Cooling: Water
  - Exhaust: Through propeller boss
  - Lubrication: Wet sump
  - Gear shift: F-N-R
  - Gear ratio: 2.15 (28/13)
  - Propeller direction: F115TR clockwise / LF115TR counter-clockwise
  - Battery minimum: CCA 380, MCA 502, RC 124 minutes
  - Fuel: Regular unleaded; PON 86 / RON 91
  - Engine oil: 4-stroke motor oil, API SE/SF/SG/SH/SJ, SAE 10W-30 or 10W-40
  - Oil capacity with filter: 4.5 L (4.76 US qt)
  - Oil capacity without filter: 4.3 L (4.55 US qt)
  - Gear oil: GEAR CASE LUBE, SAE 90
  - Gear oil total: 760 cm³ (25.7 US oz) regular / 715 cm³ (24.2 US oz) counter
  - Trim angle: –4° to 16°; tilt-up 70°; steering 30° + 30°
  - Dry weight (without propeller): L 183 kg / X 188 kg

F150TR / LF150TR (manual 63P1F11)
  - Type: 4-stroke L (inline), DOHC 16V
  - Cylinders: 4
  - Displacement: 2,670 cm³ (162.9 cu. in.)
  - Bore × stroke: 94.0 × 96.2 mm (3.70 × 3.79 in)
  - Compression ratio: 9.0
  - Max output: 110.3 kW (150 hp) @ 5,500 r/min
  - Full throttle range: 5,000–6,000 r/min
  - Max fuel consumption: 55.8 L/hr (14.7 US gal/hr) @ 6,000 r/min
  - Engine idle speed: 700 ± 50 r/min
  - Fuel system: Fuel injection
  - Ignition system: TCI
  - Alternator: 12V, 35A
  - Spark plug: NGK LFR5A-11
  - Cooling: Water
  - Exhaust: Propeller boss
  - Lubrication: Wet sump
  - Gear shift: F-N-R
  - Gear ratio: 2.00 (28/14)
  - Battery minimum: CCA 512, MCA 675, RC 182 minutes
  - Fuel: Regular unleaded; PON 86 / RON 91
  - Engine oil: SAE 10W-30 or 10W-40, API SE–SJ
  - Oil capacity with filter: 5.4 L (5.7 US qt)
  - Oil capacity without filter: 5.2 L (5.5 US qt)
  - Gear oil: SAE 90 GEAR CASE LUBE
  - Gear oil: 980 cm³ (33.1 US oz) regular / 870 cm³ (29.4 US oz) counter
  - Trim angle: –4° to 16°; tilt-up 70°; steering 35° + 35°
  - Dry weight: L 212 kg / X 216 kg

F200TR / LF200TR / F225TR / LF225TR (manual 69J1D11)
  - Type: V6 4-stroke, DOHC, 24 valves
  - Cylinders: 6
  - Displacement: 3,352 cm³ (204.5 cu. in.)
  - Bore × stroke: 94.0 × 80.5 mm (3.70 × 3.17 in)
  - Compression ratio: 9.9
  - Max output: F200 147.1 kW (200 hp) / F225 165.5 kW (225 hp) @ 5,500 r/min
  - Full throttle range: 5,000–6,000 r/min
  - Max fuel consumption: F200 66.0 L/hr / F225 70.0 L/hr @ 6,000 r/min
  - Engine idle speed: 650–750 r/min
  - Ignition control: Microcomputer TCI
  - Ignition timing: F200 TDC–BTDC 21°; F225 TDC–BTDC 24°
  - Alternator: 12V, 45A
  - Spark plug: NGK LFR5A-11
  - Oil capacity with filter: 6.0 L (6.3 US qt)
  - Oil capacity without filter: 5.8 L
  - Gear oil: 1.15 L regular rot (F200TR, F225TR) / 1.00 L counter-rot (LF200TR, LF225TR)
  - Gear ratio: 2.00 (30/15)
  - Battery minimum: CCA 512, MCA 675, RC 182 minutes
  - Trim angle: –3° to 16°; tilt-up 70°; steering 32° + 32°
  - Dry weight: X 265 kg / U 271 kg

----------------------------------------------------------------
2. MAINTENANCE / WEAR LIMITS
----------------------------------------------------------------

F115C
  - Cylinder head warpage limit: 0.1 mm (0.004 in)
  - Cylinder bore: 79.000–79.020 mm; taper limit 0.08; out-of-round 0.05
  - Piston diameter (D): 78.928–78.949 mm; oversize 79.25
  - Piston-to-cylinder clearance: 0.070–0.080 mm, limit 0.13
  - Valve clearance (cold): intake 0.20 ± 0.03 mm; exhaust 0.34 ± 0.03 mm
  - Valve seat width intake/exhaust: 1.2–1.6 mm
  - Crankshaft journal dia: 47.984–48.000 mm; min 47.972
  - Crankpin dia: 41.982–42.000 mm
  - Crankshaft runout limit: 0.03 mm
  - Oil pump discharge @1000 r/min, 100 °C, 10W-30: 5.9 L/min
  - Oil pump relief valve opens: 490 kPa (69.69 psi)
  - Thermostat opens: 48–52 °C (118–126 °F); full open 60 °C (140 °F);
    valve open lower limit 4.3 mm
  - Idling speed: 750 ± 50 r/min
  - Minimum compression pressure: 950 kPa (9.5 kgf/cm², 135 PSI)
    [ambient 20 °C / 68 °F, WOT, plugs removed from all cylinders]

F150TR
  - Cylinder head warpage limit: 0.10 mm
  - Cylinder bore: 94.000–94.017 mm
  - Piston diameter (D): 93.928–93.934 mm; piston-to-cyl clearance 0.075–0.080 mm
  - Piston pin boss bore: 21.004–21.015 mm
  - Oil pump discharge pressure: 132.0–162.0 kPa (1.32–1.62 kgf/cm²)
  - Oil pump relief valve opens: 392–490 kPa
  - Thermostat opens: 58–62 °C (136–144 °F); full open 70 °C (158 °F);
    valve open lower limit 4.3 mm
  - Minimum compression pressure: 880 kPa (128 PSI)
  - Lubrication oil pressure: 450 kPa (65.3 PSI) at idle

F200TR / F225TR
  - Cylinder head warpage limit: 0.1 mm
  - Cylinder bore: 94.00–94.02 mm
  - Piston diameter (D): 93.921–93.941 mm
  - Piston-to-cyl clearance: 0.075–0.080 mm
  - Piston pin outside dia: 21.00 mm
  - Oil pump relief valve opens: 529–647 kPa
  - Thermostat opens: 58–62 °C (136–144 °F); full open 70 °C (158 °F)
  - Minimum compression pressure: 880 kPa (125 PSI)
  - Lubrication oil pressure: 650 kPa (94 PSI) at 700 r/min

----------------------------------------------------------------
3. ELECTRICAL / SENSOR REFERENCE
----------------------------------------------------------------

Pulser coil (all three platforms, similar architecture)
  F115C pulser coil peak voltage (W/R, W/B – B):
    - cranking 1 (open): 3.5 V lower limit
    - cranking 2 (loaded): 3.0 V
    - @1,500 r/min: 26 V
    - @3,500 r/min: 44 V
  F150 pulser coil:
    - resistance 459–561 Ω
    - air gap 0.3–0.7 mm (0.0118–0.0276 in)
    - peak volt @ cranking loaded: 3.6 V
    - @1,500 r/min: 23.9 V; @3,500 r/min: 49.7 V

ECM output peak voltage
  F115C (B/R, B/W – B):
    - cranking 1: 5.0 V; cranking 2: 122 V
    - @1,500 r/min: 242 V; @3,500 r/min: 245 V
  F150 (B/O, B/W – B):
    - cranking (loaded): 260 V
    - @1,500 r/min: 260 V; @3,500 r/min: 270 V

Ignition coil (F150)
  - Primary resistance (R – B/W) @ 20 °C: 1.53–2.07 Ω
  - Secondary resistance @ 20 °C: 12.50–16.91 kΩ
  - Spark plug gap: 1.0–1.1 mm (0.039–0.043 in)

Engine coolant temperature sensor
  F115 (B/Y – B):
    - 4.62 kΩ @ 5 °C (41 °F)
    - 2.44 kΩ @ 20 °C (68 °F)
    - 0.19 kΩ @ 100 °C (212 °F)
  F150 (B/Y – B/Y):
    - 54.2–69.0 kΩ @ 20 °C
    - 3.12–3.48 kΩ @ 100 °C

Intake air temperature sensor (F150)
  - 2.20–2.70 kΩ @ 20 °C

Throttle position sensor (TPS)
  F115: output (P – B) = 0.732 ± 0.014 V at idle stop
  F150: input 5 V (O – B); output (P – B) = 0.70 ± 0.02 V at idle

Fuel injector resistance (F150) @ 20 °C: 14.0–15.0 Ω

Lighting coil / rectifier-regulator (F115)
  Lighting coil (W – W) peak voltage lower limit:
    - cranking 1 (open): 9.3 V; cranking 2 (loaded): 7.4 V
    - @1,500 r/min: 37 V (open circuit)
    - @3,500 r/min: 89 V (open circuit)
  Rectifier/regulator (R – B) peak voltage lower limit:
    - cranking 2 (loaded): 7.5 V
    - @1,500 r/min: 12.5 V; @3,500 r/min: 13.0 V

Trim sensor (F115)
  - Resistance (P – B): 9–378.8 Ω through full stroke

Starter motor
  - Type: sliding gear (all three)
  - Output: 1.4 kW (F115) / 1.40 kW (F150)
  - Rating: 30 seconds
  - Brush standard length 15.5 mm / wear limit 9.5 mm
  - Commutator standard dia 29.0 mm / wear limit 28.0 mm
  - Mica standard undercut 0.5–0.8 mm / wear limit 0.2 mm

Starting system fuses (F115)
  - Fuse 1: 12V, 20A
  - Fuse 2: 12V, 30A

Power Trim and Tilt (F115)
  - Fluid: ATF Dexron II
  - Motor brush standard length 9.8 mm / wear limit 4.8 mm

----------------------------------------------------------------
4. TORQUE SPECIFICATIONS (KEY FASTENERS)
----------------------------------------------------------------

F115C power unit
  - Flywheel magnet assembly (M24): 186 Nm (19 m·kgf, 137 ft-lb)
  - Driven sprocket (M10): 60 Nm (43 ft-lb)
  - Drive sprocket (M40): 265 Nm (192 ft-lb)
  - Timing belt tensioner (M10): 40 Nm (29 ft-lb)
  - Spark plug (M14): 25 Nm (18 ft-lb)
  - Cylinder head cover (M6): 8 Nm
  - Cylinder head (M8): 1st 14, 2nd 28 Nm
  - Cylinder head (M10, 1.5 pitch): 1st 15, 2nd 30, 3rd turn 90°
  - Connecting rod cap (M8): 1st 15, 2nd turn 60°
  - Crankcase (M10, 1.5 pitch): 1st 19, 2nd turn 60°
  - Oil filter: 18 Nm (13 ft-lb)
  - Oil pressure switch: 8 Nm
  - Exhaust cover (M6): 1st 6, 2nd 12 Nm
  - Power unit mount (M8): 42 Nm (30 ft-lb)
  - Positive battery lead (M8): 9 Nm
  - Fuel pump bracket assembly (M7): 17 Nm
F115C lower unit
  - Propeller (M18): 55 Nm (40 ft-lb)
  - Trim tab (M10): 43 Nm (31 ft-lb)
  - Lower unit (M10): 37 Nm (27 ft-lb)
  - Impeller housing (M8): 18 Nm (13 ft-lb)
  - Ring nut (M101.5): 105 Nm (76 ft-lb)
  - Pinion nut (M16): 93 Nm (67 ft-lb)
  - Gear oil drain / level check screw: 7 Nm (5.1 ft-lb)
F115C bracket
  - Upper mount (M12): 53 Nm
  - Lower mount (M14): 73 Nm

F150 (selected — see factory manual for full list)
  - Fuel pump mounting bolt (M6): 10 Nm
  - Fuel rail mounting bolt (M8): 13 Nm
  - Throttle body mounting bolt (M8): 13 Nm
  - Power unit mounting (M8/M10): 20 Nm / 42 Nm
  - Flywheel magnet nut (M24): 270 Nm (199 ft-lb)
  - Starter motor bolt (M8): 29 Nm
  - Ignition coil bolt (M6): 7 Nm
  - Oil filter: 18 Nm (13 ft-lb)
  - Timing belt tensioner: 39 Nm
  - Driven sprocket (M10): 60 Nm
  - Cylinder head bolt (M8): 1st 14, 2nd 28 Nm
  - Cylinder head bolt (M10): 1st 19, 2nd 37, 3rd +90°
  - Camshaft cap bolt (M7): 1st 8, 2nd 17 Nm
  - Cylinder head cover bolt (M6): 1st 8, 2nd 8 Nm
  - Spark plug: 25 Nm (18.4 ft-lb)
  - Engine temperature sensor: 15 Nm
  - Oil pressure sensor: 18 Nm
  - Engine hanger bolt (M6): 12 Nm
  - Balancer bolt (M8): 1st 18, 2nd 34 Nm
  - Thermostat cover bolt (M6): 12 Nm
  - Exhaust cover plug (M18): 55 Nm

----------------------------------------------------------------
5. SELF-DIAGNOSIS (FLASH CODE) SYSTEM
----------------------------------------------------------------

Procedure (all three platforms):
  1. Remove the cap from the 3-pin diagnostic connector under the cowling.
  2. Connect Yamaha test lead YB-06795 (or connect YDS).
  3. Start the engine and let it idle.
  4. Watch the diagnostic indicator. Normal = single 0.33-second flash
     every 4.95 seconds. Trouble codes are 2-digit patterns: long pulses
     (1.65 s off between them) = tens digit; short pulses (0.33 s off) =
     ones digit; separator between tens and ones = 0.33 s.
  5. Multiple faults flash lowest-numbered first — correct and re-check.

F115C code chart (from 68V manual):
   1   Normal
  13   Incorrect pick-up coil input signal
  15   Incorrect engine cooling water temp sensor input signal
  18   Incorrect throttle position sensor input signal
  19   Incorrect battery positive voltage
  23   Incorrect intake air temperature sensor input signal
  28   Incorrect shift position switch
  29   Incorrect intake air pressure sensor input signal (out of range)
  37–59  Microcomputer processing information
   (37) Intake passage air leakage
   (44) Engine stop lanyard switch control operating
   (49) Ignition timing slightly corrected (cold-start)
   (59) Memory data overwritten abnormally

F150TR code chart (from 63P manual):
   1   Normal
  13   Incorrect pulser coil signal
  15   Incorrect engine temperature sensor signal
  18   Incorrect throttle position sensor signal
  19   Incorrect battery voltage
  23   Incorrect intake air temperature sensor signal
  28   Incorrect neutral switch signal
  29   Incorrect intake air pressure sensor signal
  37   Incorrect idle speed control signal
  39   Incorrect oil pressure sensor signal
  44   Incorrect engine stop lanyard switch signal
  45   Incorrect shift cut switch signal
  46   Incorrect thermoswitch signal

F200/F225 chart (69J manual) is identical to the F150 chart.

----------------------------------------------------------------
6. FAIL-SAFE / WARNING CONTROL BEHAVIOR (F150, F200, F225)
----------------------------------------------------------------

The ECM controls ignition timing, fuel injection timing and volume,
and the ISC. On detecting a fault it may:
  - Raise engine idle speed to 900 r/min (fail-safe idle, unless the
    neutral switch is in gear).
  - Limit engine speed to approximately 2,000 r/min if the engine
    overheats, if oil pressure drops, or on certain sensor faults.
    Fuel injection is resumed only after rpm drops below 2,000 r/min.
  - Activate warning control mode — deactivated when engine speed
    drops below 1,600 r/min or the throttle closes.
  - Retard / misfire selected cylinders to fluctuate rpm as a warning.
  - Shut off fuel injection entirely if engine speed exceeds
    6,200 r/min (over-rev protection).

This means a customer report of "engine won't go over 2,000 rpm" is
usually a FAIL-SAFE response to an overheat, low oil pressure, or
sensor fault — not a mechanical limit. Read the flash codes first.

----------------------------------------------------------------
7. IGNITION / FUEL / ECM SYSTEM NOTES
----------------------------------------------------------------

The ECM calculates intake air volume from engine speed, intake air
pressure, and throttle position. These are the core enable conditions
for closed-loop fuel control — TPS, MAP, and crank/pulser must all
agree or the ECM enters limp mode.

Optimum ignition timing and air-fuel ratio are maintained under all
load conditions by the ECM. Codes 13 (pulser), 15 (coolant temp),
18 (TPS), and 29 (MAP) disable normal closed-loop operation.

F150 fuel injector resistance: 14.0–15.0 Ω @ 20 °C. Measure from
injector harness side with connector disconnected.

Ignition coil replacement on F150/F200: check primary 1.53–2.07 Ω,
secondary 12.50–16.91 kΩ at 20 °C. If replacing one, inspect all on
a V6 — salt-wicking affects coils in similar service age.

----------------------------------------------------------------
8. COOLING SYSTEM NOTES
----------------------------------------------------------------

Thermostat test (all three platforms):
  1. Remove the thermostat cover and thermostat.
  2. Suspend the thermostat in a container of water with a thermometer.
  3. Slowly heat the water while stirring.
  4. Verify opening and full-open temperatures (see §2).
  5. Replace the thermostat and cover, torque cover bolt (F150: 12 Nm).

F115 thermostat opening: 48–52 °C; full open 60 °C.
F150 and F200 thermostat opening: 58–62 °C; full open 70 °C.
Valve open lower limit: 4.3 mm (all three).

Tell-tale (pilot water) stream should be a steady, pencil-width flow
at idle. Intermittent flow points to impeller damage, cooling
passage blockage, or (less commonly) thermostat stuck closed.

----------------------------------------------------------------
9. PERIODIC MAINTENANCE SCHEDULE (TYPICAL)
----------------------------------------------------------------

Initial — 20 hours:
  - Change engine oil and filter
  - Check control cable adjustment
  - Inspect fasteners for proper torque
  - Check water pump tell-tale
  - Read and clear any diagnostic codes

Every 100 hours or annually:
  - Change engine oil and filter
  - Replace external fuel filter / water separator
  - Inspect fuel filter inside VST (if present)
  - Inspect spark plugs — clean/adjust/replace as needed
    - F115: NGK LFR6A-11
    - F150: NGK LFR5A-11
    - F200/F225: NGK LFR5A-11
  - Grease all fittings
  - Inspect water pump tell-tale and raw water passages
  - Check battery and charging system (13.8–14.8V running)
  - Inspect all fuel lines and connections
  - Change gear oil — inspect for water / metal
  - Check anodes (replace if 2/3 eroded)
  - Clean and inspect thermostat
  - Check / adjust idle RPM
  - Check cooling water passage (flush in salt service)
  - Read self-diagnosis codes before returning to service

Every 300 hours or 3 years:
  - Replace water pump impeller
  - Replace all spark plugs
  - Replace fuel hoses if deteriorated
  - Replace thermostat(s)
  - Check valve clearances (F115 cold: intake 0.20 ± 0.03,
    exhaust 0.34 ± 0.03 mm)
  - Inspect timing belt condition (F115, F150) — belt drives camshafts
  - Inspect engine mounts, upper and lower bracket mounts

----------------------------------------------------------------
10. QUICK-REFERENCE TROUBLESHOOTING DECISION TREE
----------------------------------------------------------------

A. Engine won't start
   - Confirm lanyard in RUN; battery > 12.4V
   - Watch flash codes while cranking
   - No spark → measure pulser peak voltage and primary coil
   - No fuel → check VST, main filter, fuel pressure
   - Compression < 880 kPa (F150/F200) or 950 kPa (F115) → internal

B. Engine overheats
   - STOP engine; never run raw-water-cooled dry
   - Tell-tale flow check; raw water intake clear
   - Thermostat bench test (see §8)
   - Impeller inspection and replacement
   - Thermoswitch (code 46) bench test in hot water

C. Engine won't exceed 2000 rpm
   - Read flash codes immediately — fail-safe is almost always active
   - Most common: code 39 (oil pressure), code 15/46 (overheat),
     code 13 (pulser), code 18 (TPS)

D. Rough idle / hunting
   - Check TPS idle voltage spec
   - Spray carb cleaner around intake (code 29/37 flag vacuum leaks)
   - Clean ISC valve on F150/F200
   - Verify idle RPM spec: F115 750±50, F150 700±50, F200 650–750

E. Charging low
   - Peak-voltage test lighting coil and rectifier (see §3)
   - F115 regulator: min 12.5V @1500, 13.0V @3500 r/min
   - Replace regulator only after confirming stator output good
   - Always load-test battery first

----------------------------------------------------------------
11. SAFETY AND SERVICE GUIDANCE FROM THE FACTORY MANUAL
----------------------------------------------------------------

- Never run a raw-water-cooled engine out of water without flush muffs
  and confirmed tell-tale flow.
- Use only Yamaha-approved consumables where specified (GEAR CASE LUBE,
  Yamaha 4-stroke oils, Dexron II for PTT).
- Always torque fasteners to factory spec — improper torque on the
  crankcase main bolts, crankshaft/flywheel nut, connecting rod cap,
  and cylinder head is a leading cause of comeback failures.
- On V6 F200/F225, the flywheel magnet nut is very high torque — use
  the holder tool and never impact-drive the final torque.
- When replacing any sensor, apply dielectric grease to the connector
  and route wiring away from the exhaust and hot cooling passages.
- Always clear stored codes and run the engine through an idle-to-WOT
  cycle before returning the engine to the customer.

End of factory manual reference corpus.
`;
