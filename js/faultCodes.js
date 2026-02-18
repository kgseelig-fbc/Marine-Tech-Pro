// js/faultCodes.js
//
// Fault code database for Mercury SmartCraft and Yamaha outboards.
//
// Each entry contains:
//   code         - the fault code ID
//   manufacturer - Mercury or Yamaha
//   severity     - Warning, Alarm, or Shutdown
//   system       - which engine system
//   description  - what the code means
//   causes       - probable causes (separated by | characters)
//   steps        - diagnostic steps (separated by | characters)
//   tools        - tools needed
//   parts        - parts commonly needed

window.faultCodeDatabase = [

    // =============================================
    // MERCURY SMARTCRAFT CODES
    // =============================================

    {
        code: "SC1000-14",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Sensors",
        description: "MAP Sensor Voltage High",
        causes: "Faulty MAP sensor|Damaged wiring to MAP sensor|Corroded connector pins|ECM fault (rare)",
        steps: "Step 1: Key ON engine OFF — check MAP sensor voltage at ECM connector. Should read 0.8-1.2V at rest.|Step 2: Inspect the 3-pin MAP connector for corrosion or bent pins.|Step 3: Check the 5V reference circuit from the ECM to the MAP sensor.|Step 4: Ohm-test the MAP signal wire end-to-end for continuity.|Step 5: If wiring is good, replace the MAP sensor.|Step 6: Clear the code with CDS G3 and verify it does not return.",
        tools: "DMM, Mercury CDS G3 scan tool",
        parts: "MAP sensor"
    },

    {
        code: "SC1000-16",
        manufacturer: "Mercury",
        severity: "Alarm",
        system: "Cooling",
        description: "Engine Over Temperature",
        causes: "Failed water pump impeller|Blocked water intake on lower unit|Thermostat stuck closed|Faulty temperature sender giving false reading|Corroded exhaust and cooling passages",
        steps: "Step 1: If engine is currently hot, STOP ENGINE IMMEDIATELY.|Step 2: Check the raw water intake screens on the lower unit for debris, plastic bags, or marine growth.|Step 3: Check the tell-tale (pee stream) for flow — should be a steady pencil-width stream.|Step 4: Remove and inspect the thermostat — test in hot water with a thermometer. Should open at 143°F.|Step 5: Inspect the water pump impeller for missing or curled vanes — replace if any damage.|Step 6: If all mechanical checks pass, test the temperature sender with DMM (resistance vs temp chart in service manual).",
        tools: "IR thermometer, impeller puller, DMM, garden hose with muffs",
        parts: "Water pump impeller kit, thermostat, temperature sender"
    },

    {
        code: "SC1000-18",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Cooling",
        description: "Engine Temperature Sensor Circuit — Open or Short",
        causes: "Faulty temperature sensor|Broken or corroded sensor wiring|Damaged connector|ECM input fault (rare)",
        steps: "Step 1: Locate the engine temperature sensor — typically on the cylinder head or thermostat housing.|Step 2: Disconnect the sensor and measure resistance. Should change with temperature (see spec chart).|Step 3: Check wiring from sensor to ECM for continuity.|Step 4: Check connector for corrosion or water intrusion.|Step 5: Replace sensor if out of spec.",
        tools: "DMM",
        parts: "Engine temperature sensor"
    },

    {
        code: "SC1000-21",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Fuel",
        description: "Throttle Position Sensor (TPS) Out of Range",
        causes: "Faulty TPS|TPS not calibrated|Damaged wiring|Corroded connector pins|Throttle body mechanical binding",
        steps: "Step 1: Key ON engine OFF — read TPS voltage. Should be approximately 0.5V at closed throttle and 4.5V at wide open throttle (WOT).|Step 2: Slowly sweep the throttle from closed to WOT while watching voltage — look for any dropouts, jumps, or dead spots.|Step 3: Inspect the TPS connector for corrosion.|Step 4: Check the 5V reference and ground circuits from the ECM.|Step 5: Perform TPS reset and calibration using CDS G3.|Step 6: Replace TPS if the signal is erratic during the sweep test.",
        tools: "DMM, Mercury CDS G3",
        parts: "Throttle position sensor"
    },

    {
        code: "SC1000-24",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Fuel",
        description: "Fuel Injector Circuit Malfunction",
        causes: "Failed fuel injector|Open or shorted injector wiring|Corroded injector connector|ECM driver fault (rare)",
        steps: "Step 1: Use CDS G3 to identify which cylinder is affected.|Step 2: Measure injector resistance — should be 12-16 ohms at room temperature.|Step 3: Check for 12V supply at the injector harness with key ON.|Step 4: Check ECM ground-side signal with a noid light while cranking.|Step 5: Inspect the injector connector for corrosion.|Step 6: Swap the suspect injector with a known-good cylinder — if the code follows the injector, replace it.",
        tools: "DMM, noid light, CDS G3",
        parts: "Fuel injector, injector O-rings"
    },

    {
        code: "SC1000-32",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Electrical",
        description: "Battery Voltage Low",
        causes: "Weak or dead battery|Bad alternator or stator|Loose or corroded battery connections|Excessive electrical load|Failed rectifier and regulator",
        steps: "Step 1: Check battery voltage with engine off — should be 12.4-12.8V.|Step 2: Start engine and check voltage at 1000+ RPM — should be 13.8-14.8V.|Step 3: If charging voltage is low, check alternator belt tension and condition.|Step 4: Check all battery cable connections for corrosion.|Step 5: Load test the battery.|Step 6: If charging output is low, test stator output and rectifier regulator.",
        tools: "DMM, battery load tester",
        parts: "Battery, rectifier regulator, alternator belt"
    },

    {
        code: "SC1000-34",
        manufacturer: "Mercury",
        severity: "Alarm",
        system: "Electrical",
        description: "Battery Voltage High — Overcharging",
        causes: "Failed rectifier and regulator (regulator portion)|Loose connections causing voltage spikes",
        steps: "Step 1: IMMEDIATELY check charging voltage at battery with engine running at 1000+ RPM.|Step 2: Voltage should NOT exceed 15.0V.|Step 3: If over 15V, the rectifier regulator has failed — STOP ENGINE.|Step 4: Overcharging will damage batteries and onboard electronics.|Step 5: Replace rectifier regulator. Check battery for swelling or heat damage.",
        tools: "DMM",
        parts: "Rectifier regulator, possibly new battery"
    },

    {
        code: "SC1000-38",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Sensors",
        description: "Oil Pressure Sensor Circuit Fault",
        causes: "Faulty oil pressure sender|Wiring damage|Corroded connector|Low oil level causing actual low pressure",
        steps: "Step 1: CHECK OIL LEVEL FIRST. Low oil level causes legitimately low pressure.|Step 2: If oil level is OK, install a mechanical oil pressure gauge to verify actual pressure.|Step 3: At idle, should see 25-30+ PSI. At WOT, 45-65 PSI.|Step 4: If mechanical pressure is good but sensor reads wrong, replace the oil pressure sender.|Step 5: If pressure is actually low, check oil pickup screen and pump.",
        tools: "DMM, mechanical oil pressure gauge",
        parts: "Oil pressure sender and switch"
    },

    {
        code: "SC1000-45",
        manufacturer: "Mercury",
        severity: "Shutdown",
        system: "Oil",
        description: "Low Oil Pressure — Engine Shutdown",
        causes: "Low oil level|Faulty oil pressure sender|Oil pump failure|Clogged oil pickup screen|Internal bearing failure",
        steps: "Step 1: CHECK OIL LEVEL IMMEDIATELY.|Step 2: Install a mechanical oil pressure gauge to verify actual pressure.|Step 3: At idle should see 25-30+ PSI. At WOT should see 45-65 PSI.|Step 4: If pressure is genuinely low — check oil pickup tube and screen for blockage.|Step 5: If mechanical pressure reads good, replace the oil pressure sender and switch.|Step 6: If pressure is truly low at all RPMs, suspect internal engine damage — DO NOT RUN.",
        tools: "Mechanical oil pressure gauge, DMM",
        parts: "Oil pressure sender, oil filter, oil"
    },

    {
        code: "SC1000-52",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Ignition",
        description: "Misfire Detected — Cylinder Identified",
        causes: "Fouled spark plug|Failed ignition coil|Fuel injector failure|Low compression on that cylinder|Damaged plug wire or boot",
        steps: "Step 1: Use CDS G3 to identify which cylinder is misfiring.|Step 2: Remove and inspect the spark plug from that cylinder — check gap (0.040 inch typical), look for fouling or damage.|Step 3: Swap the coil with an adjacent known-good cylinder. If misfire follows the coil, replace the coil.|Step 4: Check injector resistance on that cylinder (should be 12-16 ohms).|Step 5: Perform compression test — should be within 10% of other cylinders.|Step 6: Check the wiring to the coil and injector for that cylinder.",
        tools: "CDS G3, spark plug socket, DMM, compression tester",
        parts: "Spark plug, ignition coil, fuel injector"
    },

    {
        code: "SC1000-55",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Ignition",
        description: "Crankshaft Position Sensor (CKP) Signal Erratic",
        causes: "Faulty CKP sensor|Damaged flywheel reluctor ring|Excessive sensor-to-flywheel gap|Wiring damage or corrosion|Debris on sensor tip",
        steps: "Step 1: Inspect the CKP sensor and its connector for corrosion or damage.|Step 2: Check the sensor gap to the reluctor ring — typically 0.5-1.5mm.|Step 3: Test sensor resistance (typically 200-400 ohms — check model-specific spec).|Step 4: Inspect the flywheel reluctor ring teeth for damage or debris.|Step 5: Check wiring continuity from sensor to ECM.|Step 6: Replace sensor if out of spec or if signal is erratic on scan tool.",
        tools: "DMM, feeler gauges, CDS G3",
        parts: "Crankshaft position sensor"
    },

    {
        code: "SC1000-61",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Fuel",
        description: "Fuel Pressure Low",
        causes: "Clogged fuel filter|Weak fuel pump|Leaking fuel pressure regulator|Restricted fuel line or tank vent|Water in fuel",
        steps: "Step 1: Connect fuel pressure gauge — check pressure at key ON (pump prime) and while running.|Step 2: Mercury spec: 39-42 PSI typical.|Step 3: Replace fuel and water separator filter first — most common cause.|Step 4: Check fuel lines for kinks or soft spots.|Step 5: Pinch return line — if pressure jumps up, regulator is leaking.|Step 6: Check tank vent for blockage.|Step 7: If all external checks pass, fuel pump is weak and needs replacement.",
        tools: "Fuel pressure gauge",
        parts: "Fuel filter, fuel pressure regulator, fuel pump"
    },

    {
        code: "SC1000-65",
        manufacturer: "Mercury",
        severity: "Warning",
        system: "Sensors",
        description: "Trim Position Sensor Out of Range",
        causes: "Faulty trim sender|Corroded connector|Wiring damage|Mechanical binding in trim system",
        steps: "Step 1: Check trim sender connector for corrosion.|Step 2: Measure trim sender resistance through full range of motion — should change smoothly.|Step 3: Check wiring from sender to gauge and ECM.|Step 4: Recalibrate trim using CDS G3 if available.|Step 5: Replace trim sender if erratic.",
        tools: "DMM, CDS G3",
        parts: "Trim position sender"
    },

    // =============================================
    // YAMAHA FAULT CODES
    // =============================================

    {
        code: "YAM-12",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Sensors",
        description: "Crankshaft Position Sensor Malfunction",
        causes: "Faulty CKP sensor|Damaged flywheel reluctor ring|Wiring open or short|Excessive sensor gap|ECU fault (rare)",
        steps: "Step 1: Check CKP sensor gap — typically 0.5-1.5mm to the reluctor ring.|Step 2: Test sensor resistance with DMM — typically 200-400 ohms (check model-specific spec).|Step 3: Inspect the reluctor ring on the flywheel for damage or metallic debris.|Step 4: Check wiring continuity from the sensor to the ECU.|Step 5: Inspect the connector for corrosion — very common in marine environment.|Step 6: Replace the sensor if out of spec.",
        tools: "DMM, feeler gauges, Yamaha YDS",
        parts: "Crankshaft position sensor"
    },

    {
        code: "YAM-14",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Sensors",
        description: "Intake Air Temperature Sensor Fault",
        causes: "Faulty IAT sensor|Corroded connector|Open or shorted wiring|ECU input fault (rare)",
        steps: "Step 1: Locate the IAT sensor — typically in the intake manifold or air box.|Step 2: Disconnect and measure resistance. Should change with temperature (typically 2-3K ohms at 68 degrees F).|Step 3: Check connector for corrosion or water.|Step 4: Check wiring continuity to ECU.|Step 5: Replace sensor if out of spec.",
        tools: "DMM, YDS",
        parts: "Intake air temperature sensor"
    },

    {
        code: "YAM-17",
        manufacturer: "Yamaha",
        severity: "Alarm",
        system: "Cooling",
        description: "Engine Overheat Warning",
        causes: "Blocked water intake|Failed water pump impeller|Thermostat stuck closed|Corroded cooling passages|Faulty temperature sensor giving false reading",
        steps: "Step 1: Verify overheat is real — use IR thermometer on cylinder head. Normal operating temp: 140-180 degrees F.|Step 2: Check water intake screens on lower unit for blockage.|Step 3: Check tell-tale stream for flow.|Step 4: Inspect water pump impeller — pull lower unit to access.|Step 5: Test thermostat in hot water — should open at approximately 140 degrees F for Yamaha.|Step 6: Check temp sensor resistance against spec chart if temp seems actually normal.|Step 7: Inspect and clean the poppet valve and exhaust cooling passages.",
        tools: "IR thermometer, impeller puller, DMM",
        parts: "Water pump impeller kit, thermostat, temperature sensor"
    },

    {
        code: "YAM-19",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Sensors",
        description: "Throttle Position Sensor Fault",
        causes: "Faulty TPS|TPS not calibrated|Damaged wiring|Throttle body binding|Corroded connector",
        steps: "Step 1: Key ON engine OFF — check TPS voltage. Should be approximately 0.5V at closed, 4.5V at WOT.|Step 2: Slowly sweep throttle and watch for voltage dropouts or dead spots.|Step 3: Inspect TPS connector for corrosion.|Step 4: Check 5V reference and ground circuits from ECU.|Step 5: Calibrate TPS using YDS diagnostic tool.|Step 6: Replace TPS if signal is erratic.",
        tools: "DMM, Yamaha YDS",
        parts: "Throttle position sensor"
    },

    {
        code: "YAM-22",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Fuel",
        description: "Fuel Injector Circuit Malfunction",
        causes: "Failed fuel injector|Wiring open or short|Corroded connector|ECU driver fault (rare)|Low fuel pressure contributing",
        steps: "Step 1: Use YDS to identify the affected cylinder.|Step 2: Check injector resistance — should be 11.6-12.4 ohms at 68 degrees F for Yamaha EFI.|Step 3: Check for 12V supply to injector harness with key ON.|Step 4: Check ECU ground-side pulse with a noid light while cranking.|Step 5: Inspect the injector connector for corrosion.|Step 6: Swap the injector with a known-good cylinder to confirm the injector is the problem.",
        tools: "DMM, noid light, YDS",
        parts: "Fuel injector, injector O-rings"
    },

    {
        code: "YAM-26",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Fuel",
        description: "Fuel Pump Circuit and Low Fuel Pressure",
        causes: "Clogged fuel filter|VST pump failure|Restricted fuel line|Blocked tank vent|Water in fuel|Anti-siphon valve stuck",
        steps: "Step 1: Check fuel pressure at the rail — Yamaha spec typically 36-44 PSI.|Step 2: Replace fuel and water separator filter.|Step 3: Check for water in the separator bowl.|Step 4: Check the VST (Vapor Separator Tank) — the high-pressure pump is inside.|Step 5: Listen for the VST pump priming with key ON (2-3 second buzz).|Step 6: Check fuel lines and tank vent.|Step 7: If pump does not run, check fuse, relay, and wiring to VST.",
        tools: "Fuel pressure gauge, DMM, YDS",
        parts: "Fuel filter, VST fuel pump assembly"
    },

    {
        code: "YAM-31",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Electrical",
        description: "Charging System Voltage Low",
        causes: "Failed stator|Faulty rectifier and regulator|Loose or corroded battery connections|Worn brushes (if applicable)|Weak or dead battery",
        steps: "Step 1: Check battery voltage with engine OFF — should be 12.4-12.8V.|Step 2: Start engine — check voltage at battery at 1000+ RPM. Should be 13.8-14.8V.|Step 3: If not charging, disconnect rectifier and regulator and test stator output. Should see 20-40 VAC per stator leg at 1000 RPM.|Step 4: Test rectifier and regulator with diode function on DMM.|Step 5: Check all ground connections on engine and battery.|Step 6: Load test the battery — replace if weak.",
        tools: "DMM, battery load tester",
        parts: "Rectifier and regulator, stator, battery"
    },

    {
        code: "YAM-33",
        manufacturer: "Yamaha",
        severity: "Alarm",
        system: "Electrical",
        description: "Charging System Voltage High — Overcharging",
        causes: "Failed rectifier and regulator|Voltage regulator portion failed open",
        steps: "Step 1: Check charging voltage at battery immediately — should NOT exceed 15.0V.|Step 2: If over 15V, STOP THE ENGINE. The regulator has failed.|Step 3: Replace the rectifier and regulator.|Step 4: Check battery for swelling, heat, or damage from overcharging.|Step 5: Check all onboard electronics for damage after repair — overvoltage can damage sensitive equipment.",
        tools: "DMM",
        parts: "Rectifier and regulator, possibly new battery"
    },

    {
        code: "YAM-36",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Ignition",
        description: "Ignition Coil Circuit Fault",
        causes: "Failed ignition coil|Carbon tracking on coil boot|Damaged coil wiring|Corroded connector|ECU driver issue (rare)",
        steps: "Step 1: Identify affected cylinder from YDS.|Step 2: Inspect the coil boot for carbon tracking (black burned lines).|Step 3: Measure coil primary resistance: typically 0.2-0.5 ohms.|Step 4: Measure coil secondary resistance: typically 6K-10K ohms.|Step 5: Check coil connector for corrosion.|Step 6: Swap coil with adjacent known-good cylinder — if code follows the coil, replace it.",
        tools: "DMM, YDS",
        parts: "Ignition coil, coil boot, dielectric grease"
    },

    {
        code: "YAM-42",
        manufacturer: "Yamaha",
        severity: "Shutdown",
        system: "Oil",
        description: "Oil Pressure Below Minimum — Engine Shutdown",
        causes: "Low oil level|Oil pressure switch failure|Oil pump worn|Clogged oil filter or pickup screen|Internal bearing failure",
        steps: "Step 1: CHECK OIL LEVEL AND CONDITION IMMEDIATELY.|Step 2: Install a mechanical oil pressure gauge to verify actual pressure.|Step 3: Yamaha spec: idle 14+ PSI, WOT 43-71 PSI typical.|Step 4: If pressure reads good mechanically, replace the oil pressure switch.|Step 5: If low, inspect oil filter and pickup screen for blockage.|Step 6: Check oil for metal particles or shiny flakes — indicates bearing failure.|Step 7: Do NOT run engine with confirmed low oil pressure.",
        tools: "Mechanical oil pressure gauge, DMM",
        parts: "Oil pressure switch, oil filter, engine oil"
    },

    {
        code: "YAM-44",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Sensors",
        description: "Oil Pressure Sensor Circuit Open or Short",
        causes: "Faulty oil pressure sensor or switch|Corroded connector|Wiring damage",
        steps: "Step 1: Check oil level first.|Step 2: Disconnect oil pressure sensor and check connector for corrosion.|Step 3: Test sensor — with engine off, should have continuity to ground (normally closed). Running with good pressure, should be open.|Step 4: Check wiring from sensor to ECU for continuity.|Step 5: Replace sensor if faulty.",
        tools: "DMM",
        parts: "Oil pressure sensor and switch"
    },

    {
        code: "YAM-51",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Ignition",
        description: "Misfire Detected",
        causes: "Fouled spark plug|Failed ignition coil|Bad fuel injector|Low compression|Water in fuel|Vacuum leak",
        steps: "Step 1: Use YDS to identify which cylinder is misfiring (if possible).|Step 2: Pull and inspect spark plugs on all cylinders — check gap (0.039-0.043 inch), look for fouling.|Step 3: Swap coil with adjacent cylinder — if misfire moves, replace the coil.|Step 4: Check injector resistance (11.6-12.4 ohms at 68 degrees F).|Step 5: Check fuel pressure — low pressure causes lean misfires.|Step 6: Compression test if all ignition and fuel checks pass.",
        tools: "DMM, spark plug socket, YDS, compression tester",
        parts: "Spark plugs, ignition coil, fuel injector"
    },

    {
        code: "YAM-55",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Fuel",
        description: "Lean Condition Detected",
        causes: "Low fuel pressure|Clogged fuel filter|Vacuum leak at intake|Failing fuel injectors|Blocked fuel tank vent|Water in fuel",
        steps: "Step 1: Check fuel pressure — should be 36-44 PSI.|Step 2: Replace fuel and water separator filter.|Step 3: Check for vacuum leaks — spray carb cleaner around intake manifold gaskets while running. RPM change indicates a leak.|Step 4: Check for water in fuel separator bowl.|Step 5: Inspect fuel lines for kinks or restrictions.|Step 6: Check injector spray pattern if possible.",
        tools: "Fuel pressure gauge, carb cleaner, DMM",
        parts: "Fuel filter, intake gasket, fuel injector"
    },

    {
        code: "YAM-62",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Sensors",
        description: "Vehicle Speed and GPS Speed Signal Lost",
        causes: "NMEA 2000 network issue|GPS antenna fault|Speed sensor failure|Wiring or connector problem",
        steps: "Step 1: Check if the GPS and speed source is powered and functioning.|Step 2: Check NMEA 2000 network connections — especially T-connectors for corrosion.|Step 3: Verify the speed source is configured correctly on the Command Link display.|Step 4: Check speed sensor on lower unit if equipped.|Step 5: Check for backbone terminator issues on NMEA 2000 network.",
        tools: "DMM, YDS",
        parts: "Speed sensor, NMEA 2000 T-connectors"
    },

    {
        code: "YAM-71",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Fuel",
        description: "VST (Vapor Separator Tank) Fuel Level Low",
        causes: "Restricted fuel supply to VST|Clogged fuel filter|Anti-siphon valve stuck|Blocked tank vent|VST float valve stuck|Low fuel in main tank",
        steps: "Step 1: Check main tank fuel level.|Step 2: Replace fuel and water separator filter.|Step 3: Check primer bulb — squeeze to prime. Should get firm.|Step 4: Check anti-siphon valve at tank for sticking.|Step 5: Check fuel tank vent for blockage.|Step 6: If external supply is good, the VST float valve may be stuck — requires VST service.",
        tools: "Fuel pressure gauge",
        parts: "Fuel filter, anti-siphon valve, VST float valve"
    },

    {
        code: "YAM-75",
        manufacturer: "Yamaha",
        severity: "Warning",
        system: "Electrical",
        description: "Shift Position Sensor Fault",
        causes: "Faulty shift position sensor|Corroded connector|Wiring damage|Shift linkage out of adjustment",
        steps: "Step 1: Check shift linkage adjustment — ensure full engagement in Forward, Neutral, and Reverse.|Step 2: Inspect shift position sensor connector for corrosion.|Step 3: Test sensor output with YDS — should change cleanly between positions.|Step 4: Check wiring from sensor to ECU.|Step 5: Replace sensor if readings are erratic.",
        tools: "YDS, DMM",
        parts: "Shift position sensor"
    }

];