// js/diagnosticTrees.js
// Complete diagnostic decision tree database
// Contains: Engine No Start, Overheating, Runs Rough,
// Charging/Electrical, Trim/Steering, Electronics

window.defined_trees = {

    // =============================================
    // TREE 1: ENGINE WON'T START
    // =============================================
    engine_no_start: {
        title: "Engine Won't Start",
        requiredTools: [
            "Digital Multimeter (DMM)",
            "Inline Spark Tester",
            "Fuel Pressure Gauge",
            "Scan Tool (Mercury CDS G3 or Yamaha YDS)",
            "12V Test Light"
        ],
        startNode: "start",
        nodes: {

            start: {
                id: "start",
                type: "question",
                text: "Does the engine crank (turn over) when you turn the key?",
                help: "Cranking means you hear the starter motor spinning the engine. The engine physically turns but does not fire and run on its own.",
                options: [
                    { label: "No — completely dead, no sound at all", next: "no_crank_dead" },
                    { label: "No — I hear a click but it won't crank", next: "click_no_crank" },
                    { label: "Yes — cranks normally but won't fire", next: "cranks_wont_fire" },
                    { label: "Yes — cranks but sounds slow or weak", next: "slow_crank" }
                ]
            },

            no_crank_dead: {
                id: "no_crank_dead",
                type: "instruction",
                text: "Check battery voltage with your multimeter.",
                help: "Set your DMM to DC Volts. Put red lead on the POSITIVE (+) battery post and black lead on the NEGATIVE (-) post.",
                measurement: { label: "Battery Voltage", unit: "VDC", expectedRange: "12.4 – 12.8" },
                options: [
                    { label: "Less than 12.0V", next: "low_battery" },
                    { label: "12.0 – 12.3V", next: "marginal_battery" },
                    { label: "12.4V or higher", next: "good_batt_no_crank" }
                ]
            },

            low_battery: {
                id: "low_battery",
                type: "instruction",
                text: "Battery is significantly discharged. Let's find out why.",
                checklist: [
                    "Look at the battery terminals — any green or white crusty buildup?",
                    "Is the battery switch turned ON?",
                    "Were any lights, radio, or accessories left on?",
                    "How old is the battery? Marine batteries last 3-4 years.",
                    "Is there a main fuse or fusible link that could be blown?"
                ],
                options: [
                    { label: "Found corrosion on the terminals", next: "clean_terminals" },
                    { label: "Battery switch was OFF", next: "fix_simple" },
                    { label: "Battery is old or won't hold a charge", next: "fix_battery" },
                    { label: "Battery is newer and terminals look clean", next: "parasitic_draw" }
                ]
            },

            marginal_battery: {
                id: "marginal_battery",
                type: "instruction",
                text: "Battery voltage is borderline. Check voltage while someone cranks the engine.",
                measurement: { label: "Voltage While Cranking", unit: "VDC", expectedRange: "Should stay above 9.5" },
                options: [
                    { label: "Drops below 9.5V — battery can't handle the load", next: "fix_battery" },
                    { label: "Stays above 9.5V but still won't crank", next: "good_batt_no_crank" },
                    { label: "It actually cranked! But won't start.", next: "cranks_wont_fire" }
                ]
            },

            good_batt_no_crank: {
                id: "good_batt_no_crank",
                type: "instruction",
                text: "Battery is fine but the engine won't crank. Check the starting circuit.",
                checklist: [
                    "Is the KILL SWITCH / LANYARD in the RUN position?",
                    "Is the engine in NEUTRAL?",
                    "Does the dash light up when you turn the key to ON?",
                    "When you turn the key to START, do you hear any click from the starter relay?"
                ],
                options: [
                    { label: "Kill switch / lanyard was off!", next: "fix_lanyard" },
                    { label: "Was in gear — put in neutral, now cranks", next: "fix_simple" },
                    { label: "No dash lights at all", next: "no_dash_power" },
                    { label: "Dash lights up but no crank and no click", next: "no_relay_click" },
                    { label: "I hear a click from the relay", next: "click_no_crank" }
                ]
            },

            no_dash_power: {
                id: "no_dash_power",
                type: "instruction",
                text: "No power at the dash. There is a break in the main power feed.",
                checklist: [
                    "Check the main fuse on the engine harness (Mercury: 20A fuse. Yamaha: inline fuse on red wire)",
                    "Trace the positive battery cable — look for loose or corroded connections",
                    "Check the main engine harness plug — pull apart and look for corrosion",
                    "Check the ignition switch wiring behind the dash"
                ],
                options: [
                    { label: "Found a blown fuse", next: "fix_fuse" },
                    { label: "Found a corroded connector", next: "fix_connector" },
                    { label: "Found damaged wiring", next: "fix_wiring" },
                    { label: "Everything looks OK but still no power", next: "test_key_switch" }
                ]
            },

            test_key_switch: {
                id: "test_key_switch",
                type: "instruction",
                text: "Test the ignition switch with your multimeter.",
                help: "Mercury: PURPLE wire is battery feed in. Yamaha: RED wire is battery feed in.",
                checklist: [
                    "With key OFF — check for 12V on the battery input wire",
                    "Turn key to ON — check for 12V on the accessory output wire",
                    "Turn key to START — check for 12V on the start signal wire"
                ],
                options: [
                    { label: "No 12V on input wire — problem is upstream", next: "fix_wiring" },
                    { label: "12V in but nothing out — bad switch", next: "fix_key_switch" },
                    { label: "Switch works fine", next: "no_relay_click" }
                ]
            },

            no_relay_click: {
                id: "no_relay_click",
                type: "instruction",
                text: "Key switch works but starter relay won't click. Check between the switch and relay.",
                checklist: [
                    "Jumper across the neutral safety switch to bypass it temporarily",
                    "Check for 12V on relay trigger wire while holding key in START",
                    "Check the relay ground connection",
                    "Mercury: check for SmartCraft security lockout",
                    "Yamaha: check for Y-COP security lockout"
                ],
                options: [
                    { label: "Bypassing neutral switch fixed it", next: "fix_neutral_sw" },
                    { label: "No voltage on relay trigger wire", next: "fix_wiring" },
                    { label: "Security system lockout", next: "fix_security" },
                    { label: "Voltage and ground good — relay is bad", next: "fix_relay" }
                ]
            },

            clean_terminals: {
                id: "clean_terminals",
                type: "instruction",
                text: "Clean the corroded battery terminals and retest.",
                checklist: [
                    "Remove cables — NEGATIVE first, then POSITIVE",
                    "Scrub posts and clamps with wire brush",
                    "Reinstall — POSITIVE first, then NEGATIVE",
                    "Apply dielectric grease",
                    "Try to start the engine"
                ],
                options: [
                    { label: "Engine starts now!", next: "fix_simple" },
                    { label: "Still won't start", next: "marginal_battery" }
                ]
            },

            parasitic_draw: {
                id: "parasitic_draw",
                type: "instruction",
                text: "Battery keeps dying. Something is draining it when the engine is off.",
                help: "Disconnect NEGATIVE cable. Set DMM to AMPS. Connect between battery post and cable. Wait 5 min for computers to sleep. Read the draw.",
                measurement: { label: "Parasitic Draw", unit: "milliamps", expectedRange: "Under 50 mA" },
                checklist: [
                    "If over 50mA, pull fuses one at a time to find the draining circuit",
                    "Common culprits: stereo, chartplotter, bilge pump switch, LED lights"
                ],
                options: [
                    { label: "Found the draining circuit — fixed it", next: "fix_simple" },
                    { label: "Draw is normal — battery is just old", next: "fix_battery" },
                    { label: "Draw is normal — boat sits too long", next: "fix_maintainer" }
                ]
            },

            click_no_crank: {
                id: "click_no_crank",
                type: "question",
                text: "What kind of click do you hear?",
                help: "SINGLE click = solenoid fires but motor won't spin. RAPID clicking = not enough power.",
                options: [
                    { label: "One single click, then nothing", next: "single_click" },
                    { label: "Rapid clicking / machine gun sound", next: "rapid_click" }
                ]
            },

            single_click: {
                id: "single_click",
                type: "instruction",
                text: "Single click = solenoid fires but starter motor won't spin.",
                checklist: [
                    "Check voltage AT THE STARTER while someone holds key in START",
                    "Try tapping starter with a hammer while cranking",
                    "Check the large positive cable at the starter — clean and tight?",
                    "Check engine ground strap",
                    "Check for hydro-lock: remove spark plugs and try turning engine by hand"
                ],
                options: [
                    { label: "Low voltage at starter — cable issue", next: "fix_cables" },
                    { label: "Full 12V but won't spin (or tapping helped)", next: "fix_starter" },
                    { label: "Engine won't turn — possible hydro-lock", next: "fix_hydrolock" }
                ]
            },

            rapid_click: {
                id: "rapid_click",
                type: "instruction",
                text: "Rapid clicking = not enough current reaching the starter.",
                checklist: [
                    "Try jumping the battery from a jump pack",
                    "Clean all battery cable connections",
                    "Voltage drop test: battery positive post to starter terminal while cranking — under 0.5V",
                    "Ground drop: battery negative post to engine block while cranking — under 0.2V"
                ],
                options: [
                    { label: "Jump start worked — battery problem", next: "fix_battery" },
                    { label: "High voltage drop on positive side", next: "fix_cables" },
                    { label: "High voltage drop on ground side", next: "fix_cables" },
                    { label: "Good battery, good cables — still clicking", next: "fix_starter" }
                ]
            },

            cranks_wont_fire: {
                id: "cranks_wont_fire",
                type: "instruction",
                text: "Engine cranks normally but won't start. Check basics first:",
                checklist: [
                    "Verify fuel level — LOOK in the tank, don't trust the gauge",
                    "Kill switch / lanyard in RUN position?",
                    "Any fault codes on the display?",
                    "Pull a spark plug — does it smell like fuel?"
                ],
                options: [
                    { label: "Out of fuel!", next: "fix_add_fuel" },
                    { label: "Fault codes on display", next: "fix_check_codes" },
                    { label: "Plug is DRY — no fuel smell", next: "check_fuel" },
                    { label: "Plug is WET with fuel", next: "test_spark" },
                    { label: "Not sure — test spark first", next: "test_spark" }
                ]
            },

            test_spark: {
                id: "test_spark",
                type: "instruction",
                text: "Test for spark using your inline spark tester.",
                help: "Remove #1 spark plug. Connect tester. Ground to engine block. Crank and watch for spark.",
                options: [
                    { label: "Good spark — bright blue or white", next: "check_fuel" },
                    { label: "Weak spark — dim orange or yellow", next: "weak_spark" },
                    { label: "No spark at all", next: "no_spark" }
                ]
            },

            no_spark: {
                id: "no_spark",
                type: "instruction",
                text: "No spark detected.",
                warning: "CHECK THE KILL SWITCH AND LANYARD AGAIN RIGHT NOW. This is the #1 cause of no-spark calls.",
                checklist: [
                    "Verify kill switch / lanyard AGAIN",
                    "Check for 12V at ignition coil connector with key ON",
                    "Connect scan tool — does ECM see RPM signal while cranking?",
                    "Check ECM power and ground connections"
                ],
                options: [
                    { label: "It WAS the kill switch!", next: "fix_lanyard" },
                    { label: "No 12V at coils — power feed issue", next: "fix_wiring" },
                    { label: "No RPM/CKP signal", next: "fix_ckp" },
                    { label: "Everything OK but ECM won't fire coils", next: "ecm_problem" }
                ]
            },

            weak_spark: {
                id: "weak_spark",
                type: "instruction",
                text: "Spark is present but weak or intermittent.",
                help: "Coil specs — Mercury: Primary 0.3-0.6 ohms, Secondary 5K-8K ohms. Yamaha: Primary 0.2-0.5 ohms, Secondary 6K-10K ohms.",
                checklist: [
                    "Inspect spark plug — gap, fouling, cracked porcelain",
                    "Check coil boot for carbon tracking",
                    "Test coil primary and secondary resistance",
                    "Check engine ground strap"
                ],
                options: [
                    { label: "Bad spark plug(s)", next: "fix_plugs" },
                    { label: "Bad coil(s) or carbon tracking", next: "fix_coils" },
                    { label: "Bad engine ground", next: "fix_ground" }
                ]
            },

            check_fuel: {
                id: "check_fuel",
                type: "instruction",
                text: "Check fuel delivery. Connect fuel pressure gauge to rail test port.",
                help: "Mercury typical: 39-42 PSI. Yamaha typical: 36-44 PSI.",
                measurement: { label: "Fuel Rail Pressure", unit: "PSI", expectedRange: "36-44" },
                options: [
                    { label: "0 PSI — no fuel pressure", next: "no_fuel_pressure" },
                    { label: "Low pressure — below spec", next: "low_fuel_pressure" },
                    { label: "Pressure is within spec", next: "fuel_pressure_ok" }
                ]
            },

            no_fuel_pressure: {
                id: "no_fuel_pressure",
                type: "instruction",
                text: "No fuel pressure at all.",
                checklist: [
                    "Key ON — hear the fuel pump prime? (2-3 second buzz)",
                    "Check fuel pump fuse and relay",
                    "Squeeze primer bulb — does it get firm?",
                    "Check fuel/water separator — plugged or full of water?",
                    "Yamaha: check VST pump. Mercury: check lift pump and high-pressure pump."
                ],
                options: [
                    { label: "No pump sound — pump not running", next: "pump_not_running" },
                    { label: "Pump runs but no pressure — blockage", next: "fuel_blocked" },
                    { label: "Primer bulb stays soft — supply issue", next: "fuel_supply_blocked" },
                    { label: "Water separator full of water", next: "fix_water_fuel" }
                ]
            },

            pump_not_running: {
                id: "pump_not_running",
                type: "instruction",
                text: "Fuel pump not running. Check the circuit:",
                checklist: [
                    "Check fuel pump fuse",
                    "Check fuel pump relay — swap with identical relay to test",
                    "Check for 12V at fuel pump connector with key ON",
                    "Check ground at pump connector"
                ],
                options: [
                    { label: "Blown fuse", next: "fix_fuse" },
                    { label: "Bad relay — swapped and pump runs", next: "fix_relay" },
                    { label: "No 12V at pump — wiring problem", next: "fix_wiring" },
                    { label: "12V present but pump dead", next: "fix_fuel_pump" }
                ]
            },

            fuel_blocked: {
                id: "fuel_blocked",
                type: "instruction",
                text: "Pump runs but fuel not getting through.",
                checklist: [
                    "Replace fuel/water separator filter",
                    "Check fuel hoses for kinks or collapse",
                    "Check fuel tank vent",
                    "Check anti-siphon valve at tank"
                ],
                options: [
                    { label: "Plugged filter", next: "fix_filter" },
                    { label: "Kinked fuel hose", next: "fix_fuel_line" },
                    { label: "Blocked tank vent", next: "fix_vent" },
                    { label: "Stuck anti-siphon valve", next: "fix_antisiphon" }
                ]
            },

            fuel_supply_blocked: {
                id: "fuel_supply_blocked",
                type: "instruction",
                text: "Fuel not getting from tank to engine.",
                checklist: [
                    "Fuel shutoff valve OPEN?",
                    "Check fuel hose for kinks or disconnection",
                    "Check anti-siphon valve",
                    "Check fuel tank pickup tube",
                    "Check tank vent"
                ],
                options: [
                    { label: "Fuel shutoff was closed!", next: "fix_simple" },
                    { label: "Kinked fuel hose", next: "fix_fuel_line" },
                    { label: "Anti-siphon valve stuck", next: "fix_antisiphon" },
                    { label: "Tank vent blocked", next: "fix_vent" },
                    { label: "Tank pickup clogged", next: "fix_tank" }
                ]
            },

            low_fuel_pressure: {
                id: "low_fuel_pressure",
                type: "instruction",
                text: "Some pressure but below spec.",
                checklist: [
                    "Replace fuel/water separator filter (most common cause)",
                    "Check fuel hoses for soft spots or kinks",
                    "Check tank vent",
                    "Pinch return line — if pressure jumps, regulator leaking",
                    "Check for ethanol damage"
                ],
                options: [
                    { label: "Plugged filter", next: "fix_filter" },
                    { label: "Damaged fuel hose", next: "fix_fuel_line" },
                    { label: "Blocked tank vent", next: "fix_vent" },
                    { label: "Fuel pressure regulator leaking", next: "fix_regulator" },
                    { label: "Weak fuel pump", next: "fix_fuel_pump" }
                ]
            },

            fuel_pressure_ok: {
                id: "fuel_pressure_ok",
                type: "instruction",
                text: "Good spark AND good fuel pressure. Check injectors and compression.",
                measurement: { label: "Compression (PSI per cylinder)", unit: "PSI", expectedRange: "170-210, within 10%" },
                checklist: [
                    "Use a NOID LIGHT on injector connector — crank and watch for blinking",
                    "If noid blinks, do compression test on all cylinders"
                ],
                options: [
                    { label: "Noid light NOT blinking — ECM not commanding injectors", next: "ecm_problem" },
                    { label: "Noid blinks, compression good — still won't start", next: "advanced_no_start" },
                    { label: "Low compression on one or more cylinders", next: "low_compression" }
                ]
            },

            ecm_problem: {
                id: "ecm_problem",
                type: "instruction",
                text: "ECM not commanding injectors and/or coils.",
                checklist: [
                    "Connect scan tool — check for fault codes",
                    "Verify ECM has power and ground",
                    "Check CKP sensor signal",
                    "Mercury: check for Guardian mode / security",
                    "Yamaha: check for Y-COP lockout"
                ],
                options: [
                    { label: "Found fault codes", next: "fix_check_codes" },
                    { label: "CKP sensor issue", next: "fix_ckp" },
                    { label: "Security lockout", next: "fix_security" },
                    { label: "ECM has no power", next: "no_dash_power" },
                    { label: "Everything checks out — possible ECM failure", next: "fix_ecm" }
                ]
            },

            low_compression: {
                id: "low_compression",
                type: "instruction",
                text: "Low compression. Normal is 170-210 PSI.",
                help: "Do a WET TEST: add oil to the low cylinder and retest. If it improves = rings. If not = valves.",
                options: [
                    { label: "Worn rings (wet test improved)", next: "fix_internal" },
                    { label: "Valve problem (wet test no change)", next: "fix_internal" },
                    { label: "All cylinders low", next: "fix_escalate" }
                ]
            },

            slow_crank: {
                id: "slow_crank",
                type: "instruction",
                text: "Engine cranks too slowly. Almost always battery, cable, or starter.",
                measurement: { label: "Voltage While Cranking", unit: "VDC", expectedRange: "Above 9.5" },
                checklist: [
                    "Measure battery voltage before cranking — need 12.4V+",
                    "Measure while cranking",
                    "Check cable connections both ends",
                    "Check engine ground strap",
                    "Feel cables after cranking — hot cable = bad cable"
                ],
                options: [
                    { label: "Battery voltage low", next: "fix_battery" },
                    { label: "Drops below 9.5V while cranking", next: "fix_battery" },
                    { label: "Cable gets hot or corroded connections", next: "fix_cables" },
                    { label: "Battery and cables fine — starter dragging", next: "fix_starter" }
                ]
            },

            advanced_no_start: {
                id: "advanced_no_start",
                type: "instruction",
                text: "Have spark, fuel, injector pulse, compression — still won't start.",
                checklist: [
                    "Check spark timing with scan tool",
                    "Check for sheared flywheel key",
                    "Check exhaust for blockage (wasp nests, crushed hose)",
                    "Check air intake for blockage",
                    "Verify correct fuel — not diesel or contaminated",
                    "Spray starting fluid in intake — fires briefly = fuel delivery issue"
                ],
                options: [
                    { label: "Found it — fixed", next: "fix_simple" },
                    { label: "Can't find cause — needs shop", next: "fix_escalate" }
                ]
            },

            // RESOLUTION NODES FOR ENGINE NO START
            fix_simple: { id: "fix_simple", type: "resolution", severity: "LOW", title: "Simple Fix Applied", text: "Problem resolved with a basic correction.", action: "Document what you found. Educate the customer to prevent recurrence.", partsNeeded: [], estimatedTime: "Minimal" },

            fix_lanyard: { id: "fix_lanyard", type: "resolution", severity: "LOW", title: "Kill Switch / Safety Lanyard", text: "Kill switch or lanyard was not engaged.", action: "Re-attach lanyard and test. Show customer proper use. Inspect switch contacts for corrosion.", partsNeeded: [], estimatedTime: "5 minutes" },

            fix_battery: { id: "fix_battery", type: "resolution", severity: "MEDIUM", title: "Battery Replacement", text: "Battery has failed or is too weak.", action: "Replace battery. Clean terminals. Apply dielectric grease. TEST CHARGING SYSTEM after — should read 13.8-14.8V at 1000+ RPM. Make sure a bad alternator didn't kill this battery.", partsNeeded: ["Marine cranking battery (match group size)", "Terminal protectors", "Dielectric grease"], estimatedTime: "30-45 minutes" },

            fix_starter: { id: "fix_starter", type: "resolution", severity: "MEDIUM", title: "Starter Motor Replacement", text: "Starter motor has failed.", action: "Replace starter. Need engine serial number for correct part. Check all cable connections.", partsNeeded: ["Starter motor (engine-serial-specific)"], estimatedTime: "1-2 hours" },

            fix_fuse: { id: "fix_fuse", type: "resolution", severity: "MEDIUM", title: "Blown Fuse", text: "Fuse has blown.", action: "Replace with EXACT same amperage. If it blows again, find the short circuit.", warning: "NEVER install a higher-amp fuse. Find the short.", partsNeeded: ["Replacement fuse — same amperage"], estimatedTime: "15-60 minutes" },

            fix_connector: { id: "fix_connector", type: "resolution", severity: "MEDIUM", title: "Corroded Connector", text: "Corroded connector blocking electrical contact.", action: "Clean with DeoxIT or CRC Electronic Cleaner. Replace pins if damaged. Apply dielectric grease. Fix water intrusion source.", partsNeeded: ["DeoxIT or CRC Cleaner", "Dielectric grease", "Replacement pins if needed"], estimatedTime: "30 min – 2 hours" },

            fix_wiring: { id: "fix_wiring", type: "resolution", severity: "MEDIUM", title: "Wiring Repair", text: "Damaged or corroded wiring found.", action: "Repair with tinned marine wire and adhesive heat-shrink butt connectors. Solder + heat shrink is best.", warning: "NEVER use household wire, wire nuts, or electrical tape on a boat. Fire hazard.", partsNeeded: ["Tinned marine wire", "Adhesive heat-shrink butt connectors", "Heat gun", "Dielectric grease"], estimatedTime: "30 min – 2 hours" },

            fix_cables: { id: "fix_cables", type: "resolution", severity: "MEDIUM", title: "Battery Cable Repair", text: "Battery cables corroded or damaged.", action: "Replace with marine battery cable. Tinned copper lugs, crimped AND soldered. Stainless hardware.", partsNeeded: ["Marine battery cable", "Tinned copper lugs", "Adhesive heat shrink", "Stainless hardware"], estimatedTime: "30-60 minutes" },

            fix_key_switch: { id: "fix_key_switch", type: "resolution", severity: "MEDIUM", title: "Ignition Switch Replacement", text: "Key switch has failed.", action: "Replace switch. Match wiring carefully. Test all positions.", partsNeeded: ["Ignition key switch"], estimatedTime: "45-90 minutes" },

            fix_neutral_sw: { id: "fix_neutral_sw", type: "resolution", severity: "MEDIUM", title: "Neutral Safety Switch", text: "Neutral safety switch failed.", action: "Replace or adjust. VERIFY engine only starts in neutral after repair.", partsNeeded: ["Neutral safety switch"], estimatedTime: "30-60 minutes" },

            fix_relay: { id: "fix_relay", type: "resolution", severity: "LOW", title: "Relay Replacement", text: "Relay has failed.", action: "Replace with same type and amp rating. Check connector for burned pins.", partsNeeded: ["Replacement relay"], estimatedTime: "15-30 minutes" },

            fix_security: { id: "fix_security", type: "resolution", severity: "MEDIUM", title: "Security System Lockout", text: "Anti-theft system preventing start.", action: "Mercury: reset with CDS G3. Yamaha: reset with YDS. Check key fob battery.", partsNeeded: ["Key fob battery", "Scan tool required"], estimatedTime: "15-60 minutes" },

            fix_hydrolock: { id: "fix_hydrolock", type: "resolution", severity: "CRITICAL", title: "ENGINE HYDRO-LOCKED", text: "Water in cylinders preventing engine from turning.", action: "Remove ALL spark plugs. Crank to expel water. Find water source. Fog cylinders with oil before reinstalling plugs. Listen for rod knock on first start.", warning: "DO NOT force a hydro-locked engine. Will bend connecting rods.", partsNeeded: ["Fogging oil", "New spark plugs", "Rags"], estimatedTime: "1-4 hours" },

            fix_plugs: { id: "fix_plugs", type: "resolution", severity: "LOW", title: "Spark Plug Replacement", text: "Spark plugs fouled or worn.", action: "Replace ALL as a set. Gap to spec. Anti-seize on threads. Torque to 13 lb-ft.", help: "Mercury: typically NGK LZKAR6AP-11. Yamaha: typically NGK LKR7E. VERIFY for your engine.", partsNeeded: ["Full set spark plugs", "Anti-seize", "Torque wrench"], estimatedTime: "30-60 minutes" },

            fix_coils: { id: "fix_coils", type: "resolution", severity: "MEDIUM", title: "Ignition Coil Replacement", text: "Coil(s) failed or carbon tracking on boot.", action: "Replace coil(s). Dielectric grease in boot. Clear codes. Test run.", partsNeeded: ["Ignition coil(s)", "Dielectric grease"], estimatedTime: "20-45 min per coil" },

            fix_ckp: { id: "fix_ckp", type: "resolution", severity: "MEDIUM", title: "Crankshaft Position Sensor", text: "CKP sensor failed — ECM can't fire coils or injectors.", action: "Replace CKP sensor. Check air gap (0.5-1.5mm typical). Check connector. Clear codes.", partsNeeded: ["Crankshaft position sensor"], estimatedTime: "30 min – 1.5 hours" },

            fix_filter: { id: "fix_filter", type: "resolution", severity: "LOW", title: "Fuel Filter Replacement", text: "Fuel filter plugged.", action: "Replace filter. Drain water from separator. Prime system. Check for leaks.", partsNeeded: ["Fuel/water separator filter"], estimatedTime: "15-30 minutes" },

            fix_fuel_pump: { id: "fix_fuel_pump", type: "resolution", severity: "MEDIUM", title: "Fuel Pump Replacement", text: "Fuel pump has failed.", action: "Replace pump. Replace filter. Check all connections for leaks. Verify pressure.", warning: "FIRE HAZARD — no sparks near fuel. Fire extinguisher ready.", partsNeeded: ["Fuel pump assembly", "Fuel filter", "Fuel line clamps"], estimatedTime: "1.5-3 hours" },

            fix_fuel_line: { id: "fix_fuel_line", type: "resolution", severity: "MEDIUM", title: "Fuel Line Replacement", text: "Fuel line kinked, cracked, or deteriorated.", action: "Replace with USCG Type A marine fuel hose. Double-clamp connections.", warning: "ONLY use USCG Type A fuel hose. Non-rated hose can cause fire.", partsNeeded: ["USCG Type A fuel hose", "Stainless hose clamps"], estimatedTime: "30-90 minutes" },

            fix_water_fuel: { id: "fix_water_fuel", type: "resolution", severity: "HIGH", title: "Water in Fuel", text: "Water contamination in fuel system.", action: "Drain separator. Replace filter. Sample fuel from tank bottom. If contaminated, pump out tank.", warning: "Ethanol fuel absorbs water. Educate customer about fuel stabilizer.", partsNeeded: ["Fuel filter", "Fuel stabilizer"], estimatedTime: "30 min – 2 hours" },

            fix_vent: { id: "fix_vent", type: "resolution", severity: "LOW", title: "Tank Vent Blocked", text: "Fuel tank vent blocked, creating vacuum.", action: "Find vent on hull. Clear debris, spider webs, paint. Blow out with compressed air. Check vent hose for kinks.", partsNeeded: ["New vent fitting if corroded"], estimatedTime: "15-45 minutes" },

            fix_antisiphon: { id: "fix_antisiphon", type: "resolution", severity: "MEDIUM", title: "Anti-Siphon Valve Stuck", text: "Anti-siphon valve at tank corroded shut.", action: "Replace valve. Consider manual shutoff valve instead (check local regs).", partsNeeded: ["Anti-siphon valve or manual shutoff"], estimatedTime: "30-60 minutes" },

            fix_regulator: { id: "fix_regulator", type: "resolution", severity: "MEDIUM", title: "Fuel Pressure Regulator", text: "Regulator leaking fuel back to tank.", action: "Replace regulator. Verify pressure after.", partsNeeded: ["Fuel pressure regulator", "O-rings"], estimatedTime: "45-90 minutes" },

            fix_tank: { id: "fix_tank", type: "resolution", severity: "HIGH", title: "Fuel Tank Service", text: "Tank pickup or interior contaminated.", action: "Needs tank pump-out and cleaning. Usually shop service.", estimatedTime: "Shop — 2-8 hours" },

            fix_ground: { id: "fix_ground", type: "resolution", severity: "LOW", title: "Ground Connection Repair", text: "Ground connection corroded or loose.", action: "Clean to bare metal. New tinned ring terminal with star washer. Dielectric grease. Check ALL grounds while here.", partsNeeded: ["Tinned ring terminals", "Star washers", "Stainless hardware", "Dielectric grease"], estimatedTime: "15-30 min per connection" },

            fix_add_fuel: { id: "fix_add_fuel", type: "resolution", severity: "LOW", title: "Out of Fuel", text: "Tank is empty.", action: "Add fuel. Prime system. May need extended cranking to purge air.", partsNeeded: ["Fuel"], estimatedTime: "10-20 minutes" },

            fix_ecm: { id: "fix_ecm", type: "resolution", severity: "CRITICAL", title: "Possible ECM Failure", text: "ECM may have failed. This is RARE.", action: "Triple-check all wiring first. If truly failed, must be dealer-ordered and programmed to engine serial number.", warning: "Mercury needs CDS G3 to program. Yamaha needs YDS. Cannot use a used ECM without reprogramming.", partsNeeded: ["ECM — dealer programmed"], estimatedTime: "Dealer service" },

            fix_internal: { id: "fix_internal", type: "resolution", severity: "CRITICAL", title: "Internal Engine Damage", text: "Low compression indicates internal wear or damage.", action: "Document all readings and engine hours. Beyond field repair. Do NOT run engine.", estimatedTime: "Shop service" },

            fix_check_codes: { id: "fix_check_codes", type: "resolution", severity: "MEDIUM", title: "Fault Codes Found", text: "Engine reporting fault codes.", action: "Go to the Fault Code Lookup page from the home screen. Enter the codes shown on the display." },

            fix_maintainer: { id: "fix_maintainer", type: "resolution", severity: "LOW", title: "Battery Maintainer Recommended", text: "Battery drains from sitting between uses.", action: "Install onboard battery maintainer. Good brands: ProMariner, Guest, NOCO.", partsNeeded: ["Onboard battery maintainer"], estimatedTime: "30-60 min to install" },

            fix_escalate: { id: "fix_escalate", type: "resolution", severity: "HIGH", title: "Escalate to Shop", text: "Needs further diagnosis beyond field capability.", action: "DOCUMENT everything you tested and every reading. Take photos. This saves the next tech from repeating your work." }
        }
    },

    // =============================================
    // TREE 2: ENGINE OVERHEATING
    // =============================================
    engine_overheat: {
        title: "Engine Overheating",
        requiredTools: [
            "IR Thermometer",
            "Water Pressure Gauge",
            "Impeller Puller Set",
            "DMM",
            "Garden Hose with Muffs"
        ],
        startNode: "oh_start",
        nodes: {

            oh_start: {
                id: "oh_start",
                type: "question",
                text: "Is the engine overheating right now, or is this a reported problem?",
                options: [
                    { label: "OVERHEATING RIGHT NOW — engine is hot", next: "oh_hot_now" },
                    { label: "Customer reports intermittent overheat alarms", next: "oh_intermittent" },
                    { label: "Overheat only at certain RPM or speed", next: "oh_conditional" }
                ]
            },

            oh_hot_now: {
                id: "oh_hot_now",
                type: "instruction",
                text: "STOP THE ENGINE IMMEDIATELY if still running. Let it cool 15-20 minutes.",
                warning: "Do NOT open thermostat housing or cooling system while hot. Scalding risk.",
                checklist: [
                    "Shut down engine",
                    "Was the tell-tale (pee stream) flowing before shutdown?",
                    "While cooling, check water intakes on lower unit for debris or plastic bags"
                ],
                options: [
                    { label: "Engine cooled — ready to diagnose", next: "oh_check_telltale" },
                    { label: "Tell-tale was NOT flowing before shutdown", next: "oh_no_flow" },
                    { label: "Tell-tale WAS flowing but still overheated", next: "oh_flow_but_hot" }
                ]
            },

            oh_check_telltale: {
                id: "oh_check_telltale",
                type: "instruction",
                text: "Connect water supply (muffs or flush) and start engine at idle. Watch the tell-tale.",
                help: "Tell-tale should be a steady stream, pencil-width or better. Some pulsing is normal.",
                options: [
                    { label: "No tell-tale flow at all", next: "oh_no_flow" },
                    { label: "Weak or intermittent flow", next: "oh_weak_flow" },
                    { label: "Good tell-tale flow", next: "oh_flow_but_hot" }
                ]
            },

            oh_no_flow: {
                id: "oh_no_flow",
                type: "instruction",
                text: "No water flowing through the engine. Most likely: water pump impeller failure.",
                checklist: [
                    "Check water intake screens on lower unit for blockage",
                    "If intakes clear, the water pump impeller needs inspection",
                    "Water pump is in the lower unit — must remove lower unit to access",
                    "Inspect impeller, wear plate, and housing liner"
                ],
                options: [
                    { label: "Intakes were blocked — cleared debris", next: "oh_fix_intake" },
                    { label: "Need to check impeller — pulling lower unit", next: "oh_impeller_check" }
                ]
            },

            oh_weak_flow: {
                id: "oh_weak_flow",
                type: "instruction",
                text: "Weak tell-tale flow indicates a partially failed impeller or partial blockage.",
                checklist: [
                    "Check water intakes again thoroughly",
                    "Check tell-tale fitting itself — sometimes the fitting clogs with salt",
                    "A weak impeller can still move some water but not enough under load",
                    "Recommend pulling lower unit to inspect impeller"
                ],
                options: [
                    { label: "Tell-tale fitting was clogged — cleaned it, flow strong now", next: "oh_fix_telltale" },
                    { label: "Intakes clear, fitting clear — impeller suspect", next: "oh_impeller_check" }
                ]
            },

            oh_impeller_check: {
                id: "oh_impeller_check",
                type: "instruction",
                text: "Remove the lower unit and inspect the water pump.",
                checklist: [
                    "Remove lower unit per service manual",
                    "Remove water pump housing cover",
                    "Inspect impeller vanes — missing chunks? Curled? Cracked?",
                    "Inspect wear plate for grooves or scoring",
                    "Inspect housing liner (cup) for wear",
                    "Check water tube seal and alignment"
                ],
                options: [
                    { label: "Impeller damaged — replacing", next: "oh_fix_impeller" },
                    { label: "Impeller OK but housing/plate worn", next: "oh_fix_pump_kit" },
                    { label: "Everything looks OK — blockage must be elsewhere", next: "oh_passage_block" }
                ]
            },

            oh_flow_but_hot: {
                id: "oh_flow_but_hot",
                type: "instruction",
                text: "Water is flowing but engine still runs hot. Check thermostat and verify temp.",
                help: "Use IR thermometer on thermostat housing. Mercury normal: 143-170F. Yamaha normal: 140-176F.",
                measurement: { label: "Thermostat Housing Temp", unit: "degrees F", expectedRange: "140-176" },
                options: [
                    { label: "Over 200F — genuinely overheating", next: "oh_genuine_hot" },
                    { label: "Temp seems normal (under 180F) — sensor/gauge problem?", next: "oh_false_alarm" },
                    { label: "180-200F — borderline", next: "oh_genuine_hot" }
                ]
            },

            oh_genuine_hot: {
                id: "oh_genuine_hot",
                type: "instruction",
                text: "Engine is genuinely overheating despite water flow. Check thermostat.",
                checklist: [
                    "Remove thermostat — test in pot of hot water with thermometer",
                    "Mercury: should open at 143F. Yamaha: should open at 140F.",
                    "Check for salt/scale buildup in cooling passages",
                    "Check for possible head gasket leak (exhaust bubbles in cooling)"
                ],
                options: [
                    { label: "Thermostat stuck — replacing", next: "oh_fix_thermostat" },
                    { label: "Thermostat OK — passages may be blocked", next: "oh_passage_block" },
                    { label: "Suspect head gasket", next: "oh_fix_head_gasket" }
                ]
            },

            oh_false_alarm: {
                id: "oh_false_alarm",
                type: "instruction",
                text: "Engine temp is actually normal but alarm/gauge says overheating. Bad sensor or gauge.",
                checklist: [
                    "Test temp sensor resistance against spec chart",
                    "Check temp sensor wiring for corrosion or short to ground",
                    "Check gauge calibration",
                    "Clear alarm codes and monitor"
                ],
                options: [
                    { label: "Bad temp sensor", next: "oh_fix_sensor" },
                    { label: "Wiring issue", next: "fix_wiring" },
                    { label: "Gauge or display fault", next: "oh_fix_gauge" }
                ]
            },

            oh_intermittent: {
                id: "oh_intermittent",
                type: "instruction",
                text: "Intermittent overheat alarms. These can be tricky — could be real or false.",
                checklist: [
                    "Ask customer: at what RPM or speed does it happen?",
                    "Does the tell-tale stream weaken or stop when alarm triggers?",
                    "Check impeller age — if over 2-3 years, replace preventively",
                    "Check temp sensor connections for intermittent corrosion",
                    "Check for debris that partially blocks intake at speed"
                ],
                options: [
                    { label: "Happens at higher RPM — flow can't keep up", next: "oh_impeller_check" },
                    { label: "Happens randomly — sensor suspect", next: "oh_false_alarm" },
                    { label: "Old impeller — replacing preventively", next: "oh_fix_impeller" }
                ]
            },

            oh_conditional: {
                id: "oh_conditional",
                type: "instruction",
                text: "Overheats only at specific conditions.",
                checklist: [
                    "At idle only: thermostat may not be opening enough",
                    "At WOT only: impeller can't keep up, or partial blockage",
                    "After running awhile: thermostat sticking intermittently",
                    "Only in shallow water: intakes sucking air or sand"
                ],
                options: [
                    { label: "At idle — check thermostat", next: "oh_genuine_hot" },
                    { label: "At WOT — check impeller and flow capacity", next: "oh_impeller_check" },
                    { label: "In shallow water — intake issue", next: "oh_fix_intake" }
                ]
            },

            oh_passage_block: {
                id: "oh_passage_block",
                type: "instruction",
                text: "Cooling passages may be blocked with salt, scale, or corrosion.",
                action: "This requires flushing the cooling system with a descaling solution. If severely blocked, may need to disassemble and clean at the shop. Check the poppet valve and exhaust cooling passages on Yamaha engines.",
                estimatedTime: "1-4 hours for flush, longer if disassembly needed"
            },

            // OVERHEAT RESOLUTIONS
            oh_fix_intake: { id: "oh_fix_intake", type: "resolution", severity: "LOW", title: "Water Intake Cleared", text: "Debris was blocking the water intake.", action: "Clear intake screens. Run engine and verify good tell-tale flow and normal temp. Educate customer to check intakes before starting.", partsNeeded: [], estimatedTime: "15-30 minutes" },

            oh_fix_telltale: { id: "oh_fix_telltale", type: "resolution", severity: "LOW", title: "Tell-Tale Fitting Cleared", text: "Tell-tale fitting was clogged.", action: "Clean tell-tale fitting with wire or compressed air. Run engine and verify steady stream. Note: a clogged tell-tale doesn't mean the engine is overheating — but you can't monitor cooling without it.", partsNeeded: [], estimatedTime: "10-15 minutes" },

            oh_fix_impeller: { id: "oh_fix_impeller", type: "resolution", severity: "MEDIUM", title: "Water Pump Impeller Replacement", text: "Impeller damaged and needs replacement.", action: "Replace impeller, wear plate, gaskets, and seals. Reassemble lower unit. Refill gear oil. Run on muffs and verify strong tell-tale flow. Check temp with IR thermometer — should stabilize 140-170F.", partsNeeded: ["Water pump impeller kit (impeller, wear plate, gaskets, seals)", "Lower unit gasket", "Gear oil"], estimatedTime: "1.5-3 hours" },

            oh_fix_pump_kit: { id: "oh_fix_pump_kit", type: "resolution", severity: "MEDIUM", title: "Water Pump Kit Replacement", text: "Pump housing, liner, or wear plate is worn.", action: "Replace complete water pump kit including housing liner, wear plate, impeller, and all seals.", partsNeeded: ["Complete water pump rebuild kit", "Gear oil"], estimatedTime: "2-3 hours" },

            oh_fix_thermostat: { id: "oh_fix_thermostat", type: "resolution", severity: "MEDIUM", title: "Thermostat Replacement", text: "Thermostat stuck closed or partially stuck.", action: "Replace thermostat(s) and gaskets. Most engines have 2 thermostats. Run on muffs and verify temp stabilizes normally.", partsNeeded: ["Thermostat(s) — OEM recommended", "Thermostat gasket(s)"], estimatedTime: "45 min – 1.5 hours" },

            oh_fix_sensor: { id: "oh_fix_sensor", type: "resolution", severity: "LOW", title: "Temperature Sensor Replacement", text: "Temp sensor giving false readings.", action: "Replace sensor. Clear codes. Run and verify correct reading.", partsNeeded: ["Temperature sensor"], estimatedTime: "30-45 minutes" },

            oh_fix_gauge: { id: "oh_fix_gauge", type: "resolution", severity: "LOW", title: "Gauge or Display Issue", text: "Gauge reading incorrectly.", action: "Check gauge wiring. If SmartCraft/Command Link display, may need software update or display replacement.", estimatedTime: "30-60 minutes" },

            oh_fix_head_gasket: { id: "oh_fix_head_gasket", type: "resolution", severity: "CRITICAL", title: "Possible Head Gasket Failure", text: "Combustion gases entering cooling system.", action: "This is a shop repair. Document symptoms. Do not run engine extensively — exhaust gas in cooling system causes rapid overheating and further damage.", estimatedTime: "Shop service" }
        }
    },

    // =============================================
    // TREE 3: ENGINE RUNS ROUGH / MISFIRES
    // =============================================
    engine_runs_rough: {
        title: "Runs Rough / Misfires",
        requiredTools: [
            "DMM",
            "Scan Tool (CDS G3 or YDS)",
            "Spark Plug Socket",
            "Fuel Pressure Gauge",
            "Compression Tester"
        ],
        startNode: "rr_start",
        nodes: {

            rr_start: {
                id: "rr_start",
                type: "question",
                text: "When does the rough running happen?",
                options: [
                    { label: "At idle only", next: "rr_idle" },
                    { label: "At all RPMs", next: "rr_all_rpm" },
                    { label: "Only at higher RPM or under load", next: "rr_under_load" },
                    { label: "Intermittent — comes and goes randomly", next: "rr_intermittent" },
                    { label: "Only when cold — smooths out when warm", next: "rr_cold_only" }
                ]
            },

            rr_idle: {
                id: "rr_idle",
                type: "instruction",
                text: "Rough at idle. Connect scan tool and check for codes and live data.",
                checklist: [
                    "Check for DTCs and look at misfire counts",
                    "Check idle RPM — Mercury: 600-700 in neutral. Yamaha: 600-700 in neutral.",
                    "Look for vacuum leaks — spray carb cleaner around intake gaskets while idling. RPM change = leak.",
                    "Check spark plugs condition"
                ],
                options: [
                    { label: "Fault codes found", next: "fix_check_codes" },
                    { label: "Idle RPM hunting / surging", next: "rr_surge" },
                    { label: "Steady misfire — engine shaking", next: "rr_steady_miss" },
                    { label: "Found vacuum leak", next: "rr_fix_vacuum" }
                ]
            },

            rr_surge: {
                id: "rr_surge",
                type: "instruction",
                text: "Idle surging — RPM goes up and down rhythmically.",
                checklist: [
                    "Spray carb cleaner around intake gaskets — RPM change = vacuum leak",
                    "Check IAC (Idle Air Control) valve — remove and clean or replace",
                    "Check TPS — is it reading correct idle voltage (about 0.5V)?",
                    "Check for water in fuel",
                    "Check engine grounds"
                ],
                options: [
                    { label: "Found vacuum leak", next: "rr_fix_vacuum" },
                    { label: "IAC valve dirty/stuck", next: "rr_fix_iac" },
                    { label: "TPS out of calibration", next: "rr_fix_tps" },
                    { label: "Water in fuel", next: "fix_water_fuel" }
                ]
            },

            rr_steady_miss: {
                id: "rr_steady_miss",
                type: "instruction",
                text: "Steady misfire. Identify which cylinder(s).",
                help: "With engine idling, disconnect one coil at a time. If RPM drops when you disconnect a coil, that cylinder WAS firing. If NO change, that cylinder is already dead.",
                options: [
                    { label: "Single cylinder misfire", next: "rr_single_cyl" },
                    { label: "Multiple cylinders misfiring", next: "rr_multi_cyl" },
                    { label: "Random — different cylinders", next: "rr_random" }
                ]
            },

            rr_single_cyl: {
                id: "rr_single_cyl",
                type: "instruction",
                text: "Single cylinder misfire. Isolate the cause on that cylinder:",
                checklist: [
                    "Remove and inspect spark plug — gap, fouling, damage",
                    "Swap coil with adjacent known-good cylinder. Misfire follows coil = bad coil.",
                    "Check injector resistance (Mercury: 12-16 ohms. Yamaha: 11.6-12.4 ohms)",
                    "Swap injector to another cylinder. Misfire follows = bad injector.",
                    "Compression test that cylinder"
                ],
                options: [
                    { label: "Bad spark plug", next: "fix_plugs" },
                    { label: "Bad coil — misfire followed it", next: "fix_coils" },
                    { label: "Bad injector — misfire followed it", next: "rr_fix_injector" },
                    { label: "Low compression", next: "low_compression" }
                ]
            },

            rr_multi_cyl: {
                id: "rr_multi_cyl",
                type: "instruction",
                text: "Multiple cylinders misfiring. Usually a system-wide issue, not one bad part.",
                checklist: [
                    "Check fuel pressure — low pressure starves all cylinders",
                    "Check for water in fuel",
                    "Check all spark plugs — are they all worn?",
                    "Check for intake manifold vacuum leak (affects multiple cylinders)",
                    "Check engine grounds"
                ],
                options: [
                    { label: "Low fuel pressure", next: "low_fuel_pressure" },
                    { label: "Water in fuel", next: "fix_water_fuel" },
                    { label: "All plugs worn — need full set", next: "fix_plugs" },
                    { label: "Intake vacuum leak", next: "rr_fix_vacuum" },
                    { label: "Bad grounds", next: "fix_ground" }
                ]
            },

            rr_random: {
                id: "rr_random",
                type: "instruction",
                text: "Random misfires across different cylinders. Same causes as multiple cylinder miss.",
                options: [
                    { label: "Check fuel system", next: "check_fuel" },
                    { label: "Check spark plugs", next: "rr_single_cyl" },
                    { label: "Check for water in fuel", next: "fix_water_fuel" }
                ]
            },

            rr_under_load: {
                id: "rr_under_load",
                type: "instruction",
                text: "Rough only under load or at higher RPM. Often fuel delivery issue.",
                checklist: [
                    "Check fuel pressure under load if possible",
                    "Replace fuel filter — restricted filter can't flow enough at WOT",
                    "Check fuel tank vent — restricted vent = vacuum at high fuel flow",
                    "Check spark plugs for lean condition (white porcelain = running lean)",
                    "Check prop — wrong pitch? Damaged? Ventilating?",
                    "Check WOT RPM — should reach manufacturer spec"
                ],
                options: [
                    { label: "Fuel pressure drops under load", next: "low_fuel_pressure" },
                    { label: "Plugged filter", next: "fix_filter" },
                    { label: "Blocked vent", next: "fix_vent" },
                    { label: "Prop issue", next: "rr_fix_prop" },
                    { label: "Ignition breaking down at high RPM", next: "rr_ignition_breakdown" }
                ]
            },

            rr_ignition_breakdown: {
                id: "rr_ignition_breakdown",
                type: "instruction",
                text: "Ignition works at idle but fails at higher RPM.",
                checklist: [
                    "Check spark plug gaps — too wide increases voltage demand",
                    "Check coil boots for carbon tracking",
                    "Check coil secondary resistance",
                    "Check for damaged boots near heat sources"
                ],
                options: [
                    { label: "Wide plug gaps — replacing plugs", next: "fix_plugs" },
                    { label: "Carbon tracking on boots", next: "fix_coils" },
                    { label: "Bad coil(s)", next: "fix_coils" }
                ]
            },

            rr_intermittent: {
                id: "rr_intermittent",
                type: "instruction",
                text: "Intermittent rough running. Harder to diagnose — need to catch it happening.",
                checklist: [
                    "Connect scan tool and monitor live data while running",
                    "Watch fuel pressure — does it drop when it gets rough?",
                    "Check all wiring connections — wiggle connectors while running to provoke the issue",
                    "Check for loose ground connections",
                    "Water in fuel can cause intermittent misfires as water slugs hit injectors"
                ],
                options: [
                    { label: "Fuel pressure drops intermittently", next: "low_fuel_pressure" },
                    { label: "Found a loose connector — problem reproduced", next: "fix_connector" },
                    { label: "Water in fuel suspected", next: "fix_water_fuel" },
                    { label: "Can't reproduce — recommend monitoring", next: "rr_fix_monitor" }
                ]
            },

            rr_cold_only: {
                id: "rr_cold_only",
                type: "instruction",
                text: "Rough only when cold, smooths out after warming up.",
                checklist: [
                    "Check coolant temp sensor — if reading wrong temp, ECM uses wrong fuel map",
                    "Check spark plugs — fouled plugs often misfire when cold",
                    "Check fuel injectors — slightly clogged injectors work OK when warm but not cold",
                    "Check for intake vacuum leak — more noticeable at cold idle"
                ],
                options: [
                    { label: "Bad temp sensor (cold enrichment not working right)", next: "oh_fix_sensor" },
                    { label: "Fouled spark plugs", next: "fix_plugs" },
                    { label: "Partially clogged injectors", next: "rr_fix_injector" },
                    { label: "Vacuum leak", next: "rr_fix_vacuum" }
                ]
            },

            rr_all_rpm: {
                id: "rr_all_rpm",
                type: "instruction",
                text: "Rough at ALL RPMs. Start with scan tool, then basics.",
                options: [
                    { label: "Fault codes found", next: "fix_check_codes" },
                    { label: "Identify which cylinder(s)", next: "rr_steady_miss" },
                    { label: "Check fuel system", next: "check_fuel" }
                ]
            },

            // RUNS ROUGH RESOLUTIONS
            rr_fix_vacuum: { id: "rr_fix_vacuum", type: "resolution", severity: "MEDIUM", title: "Vacuum / Intake Leak", text: "Air leak found at intake.", action: "Replace leaking gasket(s). Verify repair by monitoring idle quality and fuel trim on scan tool.", partsNeeded: ["Intake gasket(s)", "Throttle body gasket if applicable"], estimatedTime: "1-2 hours" },

            rr_fix_iac: { id: "rr_fix_iac", type: "resolution", severity: "LOW", title: "IAC Valve Service", text: "Idle Air Control valve dirty or stuck.", action: "Remove IAC valve. Clean with throttle body cleaner. Inspect pintle for carbon. Reinstall or replace. Do idle relearn with scan tool.", partsNeeded: ["Throttle body cleaner", "IAC valve if replacing"], estimatedTime: "30-60 minutes" },

            rr_fix_tps: { id: "rr_fix_tps", type: "resolution", severity: "LOW", title: "TPS Adjustment/Replacement", text: "Throttle Position Sensor out of calibration.", action: "Check TPS voltage at idle (about 0.5V). Recalibrate with scan tool. Replace if erratic on sweep test. Do TPS learn after replacement.", partsNeeded: ["TPS sensor if replacing"], estimatedTime: "30-60 minutes" },

            rr_fix_injector: { id: "rr_fix_injector", type: "resolution", severity: "MEDIUM", title: "Fuel Injector Replacement/Cleaning", text: "Fuel injector(s) failed or clogged.", action: "Replace or professionally clean injectors. Replace O-rings. Check fuel rail for debris. Clear codes. Verify spray pattern.", partsNeeded: ["Fuel injector(s)", "Injector O-rings"], estimatedTime: "1-2 hours" },

            rr_fix_prop: { id: "rr_fix_prop", type: "resolution", severity: "LOW", title: "Propeller Issue", text: "Prop is damaged, wrong pitch, or hub is spun.", action: "Inspect prop for dings, bent blades. Check hub for spin (hold prop, try to turn engine). Verify correct pitch for boat/engine. Typical WOT RPM should reach manufacturer spec.", partsNeeded: ["Possibly new prop or prop repair"], estimatedTime: "30-60 minutes" },

            rr_fix_monitor: { id: "rr_fix_monitor", type: "resolution", severity: "LOW", title: "Intermittent — Continue Monitoring", text: "Could not reproduce the problem.", action: "Document all checks performed. Recommend customer note exact conditions when it happens: RPM, speed, temperature, duration. Schedule a follow-up sea trial if possible." }
        }
    },

    // =============================================
    // TREE 4: CHARGING / ELECTRICAL
    // =============================================
    charging_electrical: {
        title: "Charging / Battery / Electrical",
        requiredTools: [
            "DMM",
            "Battery Load Tester",
            "Clamp-on Ammeter"
        ],
        startNode: "ch_start",
        nodes: {

            ch_start: {
                id: "ch_start",
                type: "question",
                text: "What is the electrical complaint?",
                options: [
                    { label: "Battery keeps dying / won't hold charge", next: "ch_battery_dying" },
                    { label: "Low voltage alarm while running", next: "ch_low_volt" },
                    { label: "Battery boiling / bulging / hot", next: "ch_overcharge" },
                    { label: "Accessories not working", next: "ch_accessories" },
                    { label: "Lights dim at idle, brighten at RPM", next: "ch_dim_lights" }
                ]
            },

            ch_battery_dying: {
                id: "ch_battery_dying",
                type: "instruction",
                text: "Battery keeps going dead. Is it a charging problem or a drain problem?",
                measurement: { label: "Charging Voltage at 1000 RPM", unit: "VDC", expectedRange: "13.8-14.8" },
                checklist: [
                    "Test battery condition — load test or CCA test",
                    "Check battery age (3-4 year life typical)",
                    "Start engine, check voltage at battery at 1000+ RPM",
                    "Should read 13.8-14.8V if charging"
                ],
                options: [
                    { label: "Charging voltage good (13.8-14.8V) — battery or drain issue", next: "parasitic_draw" },
                    { label: "Not charging — stays at 12V or below with engine running", next: "ch_not_charging" },
                    { label: "Battery failed load test", next: "fix_battery" }
                ]
            },

            ch_not_charging: {
                id: "ch_not_charging",
                type: "instruction",
                text: "Engine runs but not charging. System: Stator → Rectifier/Regulator → Battery.",
                checklist: [
                    "Check wiring from engine to battery — trace the charging wire",
                    "Check for blown charging fuse",
                    "Disconnect rectifier/regulator and test stator output (AC voltage)",
                    "At 1000 RPM should see 20-40 VAC per stator leg",
                    "If stator good, test rectifier/regulator"
                ],
                measurement: { label: "Stator AC Output", unit: "VAC", expectedRange: "20-40 per leg at 1000 RPM" },
                options: [
                    { label: "Stator output zero or very low", next: "ch_fix_stator" },
                    { label: "Stator good — rectifier/regulator bad", next: "ch_fix_rectifier" },
                    { label: "Both seem OK — wiring issue", next: "fix_wiring" }
                ]
            },

            ch_low_volt: {
                id: "ch_low_volt",
                type: "instruction",
                text: "Low voltage alarm while running.",
                options: [
                    { label: "Check charging system", next: "ch_not_charging" },
                    { label: "Check for excessive electrical load", next: "ch_fix_load" },
                    { label: "Check battery connections", next: "ch_battery_dying" }
                ]
            },

            ch_overcharge: {
                id: "ch_overcharge",
                type: "instruction",
                text: "DANGER — Battery overcharging. Risk of explosion.",
                warning: "If battery is swollen, hot, or smells like rotten eggs, disconnect carefully. Wear safety glasses and gloves.",
                measurement: { label: "Charging Voltage", unit: "VDC", expectedRange: "Should NOT exceed 15.0V" },
                options: [
                    { label: "Over 15V — rectifier/regulator failed", next: "ch_fix_rectifier_urgent" },
                    { label: "Voltage normal — battery has internal short", next: "fix_battery" }
                ]
            },

            ch_accessories: {
                id: "ch_accessories",
                type: "question",
                text: "Which accessories are not working?",
                options: [
                    { label: "NOTHING works — boat is completely dead", next: "ch_totally_dead" },
                    { label: "Some things work, some don't", next: "ch_partial" },
                    { label: "One specific item doesn't work", next: "ch_single_item" }
                ]
            },

            ch_totally_dead: {
                id: "ch_totally_dead",
                type: "instruction",
                text: "No electrical power anywhere.",
                checklist: [
                    "Battery switch ON?",
                    "Check battery voltage",
                    "Check main bus bar connections",
                    "Check main breaker or master fuse",
                    "Check positive cable from battery to panel"
                ],
                options: [
                    { label: "Battery switch was off", next: "fix_simple" },
                    { label: "Dead battery", next: "fix_battery" },
                    { label: "Corroded main connection", next: "fix_connector" },
                    { label: "Blown main breaker/fuse", next: "ch_fix_breaker" },
                    { label: "Damaged cable", next: "fix_cables" }
                ]
            },

            ch_partial: {
                id: "ch_partial",
                type: "instruction",
                text: "Some circuits work, some don't. Problem is on a specific circuit.",
                checklist: [
                    "Which items don't work? Which do?",
                    "Check fuse panel — look for blown fuses on dead circuits",
                    "Check for tripped breakers (push to reset)",
                    "Check bus bar connections behind the panel"
                ],
                options: [
                    { label: "Found blown fuse(s)", next: "fix_fuse" },
                    { label: "Tripped breaker — reset it", next: "fix_simple" },
                    { label: "Corroded bus bar", next: "fix_connector" },
                    { label: "Fuses good — wiring issue", next: "fix_wiring" }
                ]
            },

            ch_single_item: {
                id: "ch_single_item",
                type: "instruction",
                text: "Single accessory not working. Basic troubleshooting:",
                checklist: [
                    "Check fuse for that circuit",
                    "Check for 12V at the device connector",
                    "If 12V present but device dead — device failed",
                    "If no 12V — trace wire back to panel",
                    "CHECK THE GROUND — #1 cause of marine electrical problems"
                ],
                options: [
                    { label: "Blown fuse", next: "fix_fuse" },
                    { label: "No power to device — wiring", next: "fix_wiring" },
                    { label: "Power present — device failed", next: "ch_fix_device" },
                    { label: "Bad ground connection", next: "fix_ground" }
                ]
            },

            ch_dim_lights: {
                id: "ch_dim_lights",
                type: "instruction",
                text: "Lights dim at idle but brighten at higher RPM. Charging system can't keep up at low RPM.",
                options: [
                    { label: "Check charging output at idle", next: "ch_not_charging" },
                    { label: "Excessive electrical load", next: "ch_fix_load" },
                    { label: "Bad battery pulling system down", next: "fix_battery" },
                    { label: "High resistance connections", next: "fix_cables" }
                ]
            },

            // CHARGING RESOLUTIONS
            ch_fix_stator: { id: "ch_fix_stator", type: "resolution", severity: "HIGH", title: "Stator Failure", text: "Stator not producing output.", action: "Replace stator. Usually requires flywheel removal. Also verify rectifier/regulator is good before reassembly. Test charging after.", partsNeeded: ["Stator assembly", "Flywheel puller required"], estimatedTime: "2-4 hours" },

            ch_fix_rectifier: { id: "ch_fix_rectifier", type: "resolution", severity: "MEDIUM", title: "Rectifier/Regulator Failure", text: "Rectifier/regulator not converting stator output to DC charging.", action: "Replace rectifier/regulator. Check stator connector for heat damage. Test charging output: 13.8-14.8V at 1000+ RPM.", partsNeeded: ["Rectifier/regulator"], estimatedTime: "45 min – 1.5 hours" },

            ch_fix_rectifier_urgent: { id: "ch_fix_rectifier_urgent", type: "resolution", severity: "CRITICAL", title: "Rectifier/Regulator OVERCHARGING", text: "Regulator failed — sending too much voltage to battery and electronics.", action: "DO NOT RUN ENGINE until replaced. Replace rectifier/regulator. Check battery for damage. Check ALL onboard electronics after repair — overvoltage may have damaged them.", warning: "Overcharging can destroy batteries, MFDs, radios, and other electronics.", partsNeeded: ["Rectifier/regulator", "Possibly new battery"], estimatedTime: "1-2 hours" },

            ch_fix_breaker: { id: "ch_fix_breaker", type: "resolution", severity: "MEDIUM", title: "Main Breaker Tripped", text: "Main circuit breaker tripped or main fuse blown.", action: "Reset breaker or replace fuse. If it trips again immediately, there is a SHORT CIRCUIT. Disconnect all circuits and reconnect one at a time to find the short.", partsNeeded: ["Replacement fuse if applicable"], estimatedTime: "15-60 minutes" },

            ch_fix_device: { id: "ch_fix_device", type: "resolution", severity: "LOW", title: "Device Failed", text: "Individual accessory has failed.", action: "Replace the device. Verify proper power and ground at new device.", estimatedTime: "Varies" },

            ch_fix_load: { id: "ch_fix_load", type: "resolution", severity: "LOW", title: "Excessive Electrical Load", text: "Too many accessories for the charging system.", action: "Audit electrical loads. Consider adding a second battery with isolator/ACR. Educate customer to manage loads at idle (turn off unnecessary items). Consider battery monitor installation.", partsNeeded: ["Possibly second battery and ACR/isolator"], estimatedTime: "Consultation + possible install 2-4 hours" }
        }
    },

    // =============================================
    // TREE 5: TRIM AND STEERING
    // =============================================
    trim_steering: {
        title: "Trim & Steering Problems",
        requiredTools: [
            "DMM",
            "12V Test Light",
            "Trim/Tilt Fluid",
            "Hydraulic Steering Fluid"
        ],
        startNode: "ts_start",
        nodes: {

            ts_start: {
                id: "ts_start",
                type: "question",
                text: "What is the trim or steering complaint?",
                options: [
                    { label: "Trim/tilt not working at all", next: "ts_trim_dead" },
                    { label: "Trim works one direction only", next: "ts_one_dir" },
                    { label: "Trim is slow or weak", next: "ts_trim_slow" },
                    { label: "Trim motor runs but engine doesn't move", next: "ts_no_movement" },
                    { label: "Hydraulic steering is stiff", next: "ts_stiff_steering" },
                    { label: "Steering has play / loose", next: "ts_loose_steering" }
                ]
            },

            ts_trim_dead: {
                id: "ts_trim_dead",
                type: "instruction",
                text: "Trim/tilt completely dead. Check the electrical circuit:",
                checklist: [
                    "Check trim fuse or breaker (typically 40-60A)",
                    "Listen for the trim pump motor when pressing switch",
                    "Check trim relay(s)",
                    "Try the switch on the engine cowl as alternate test",
                    "Check wiring between switch and relay"
                ],
                options: [
                    { label: "Blown fuse/breaker", next: "ts_fix_breaker" },
                    { label: "No motor sound, relay not clicking", next: "ts_relay_check" },
                    { label: "Relay clicks but motor doesn't run", next: "ts_motor_check" },
                    { label: "Motor runs but no movement", next: "ts_no_movement" },
                    { label: "Helm switch dead, cowl switch works", next: "ts_fix_switch" }
                ]
            },

            ts_relay_check: {
                id: "ts_relay_check",
                type: "instruction",
                text: "Trim relay not activating. Check the relay circuit:",
                checklist: [
                    "Locate trim relay(s) — Mercury: blue/green solenoid near pump. Yamaha: relay near pump.",
                    "Check for 12V at relay power input (large terminal)",
                    "Press trim switch — check for 12V on relay trigger wire",
                    "Try jumping the relay directly with a fused jumper wire"
                ],
                options: [
                    { label: "No power to relay — wiring issue", next: "fix_wiring" },
                    { label: "No trigger signal — switch or wiring bad", next: "ts_fix_switch" },
                    { label: "Jumped relay and motor ran — relay is bad", next: "ts_fix_relay" }
                ]
            },

            ts_motor_check: {
                id: "ts_motor_check",
                type: "instruction",
                text: "Relay clicks but trim motor doesn't run.",
                checklist: [
                    "Check voltage at trim motor while pressing switch — should see 12V+",
                    "Check motor ground connection",
                    "Try tapping motor while pressing switch (stuck brushes)",
                    "Feel motor after attempting — hot motor = seized/stalled"
                ],
                options: [
                    { label: "No voltage at motor — wiring between relay and motor", next: "fix_wiring" },
                    { label: "Tapping freed it — motor is failing", next: "ts_fix_motor" },
                    { label: "Voltage present, motor won't spin — motor dead", next: "ts_fix_motor" }
                ]
            },

            ts_no_movement: {
                id: "ts_no_movement",
                type: "instruction",
                text: "Motor runs (you hear the pump) but engine doesn't move. Hydraulic issue.",
                checklist: [
                    "Check hydraulic fluid level in trim reservoir — LOW FLUID is the most common cause",
                    "Look for fluid leaks at trim rams, seals, and lines",
                    "Check for blown trim ram seals (fluid weeping around shafts)",
                    "Check if manual release valve is open (screw on the trim unit) — if open, system can't build pressure"
                ],
                options: [
                    { label: "Low fluid — adding fluid", next: "ts_fix_fluid" },
                    { label: "Leaking ram seal(s)", next: "ts_fix_seals" },
                    { label: "Manual release was open", next: "fix_simple" },
                    { label: "Fluid full, no leaks — internal pump failure", next: "ts_fix_pump" }
                ]
            },

            ts_one_dir: {
                id: "ts_one_dir",
                type: "instruction",
                text: "Trim only works in one direction. Usually a relay or valve issue.",
                checklist: [
                    "Which direction fails — UP or DOWN?",
                    "Each direction has its own relay — one may be failed",
                    "Check trim sender — some systems limit range if sender is faulty",
                    "Check for debris in hydraulic valve body"
                ],
                options: [
                    { label: "One relay bad (clicks one way, not the other)", next: "ts_fix_relay" },
                    { label: "Both relays click but one direction fails — valve issue", next: "ts_fix_pump" },
                    { label: "Hits a limit — sender issue", next: "ts_fix_sender" }
                ]
            },

            ts_trim_slow: {
                id: "ts_trim_slow",
                type: "instruction",
                text: "Trim moves but is slow or weak.",
                checklist: [
                    "Check hydraulic fluid level — low fluid means air in system",
                    "Check battery voltage — low voltage = slow motor = slow pump",
                    "Check for restricted or kinked hydraulic lines",
                    "Old contaminated fluid may need flush and refill"
                ],
                options: [
                    { label: "Low fluid", next: "ts_fix_fluid" },
                    { label: "Low battery / bad connections", next: "fix_battery" },
                    { label: "Motor drawing high amps — failing", next: "ts_fix_motor" },
                    { label: "Needs fluid flush", next: "ts_fix_flush" }
                ]
            },

            ts_stiff_steering: {
                id: "ts_stiff_steering",
                type: "instruction",
                text: "Hydraulic steering is hard to turn.",
                checklist: [
                    "Check hydraulic steering fluid level at helm pump",
                    "Bleed the system — air in lines causes stiffness",
                    "Check for kinked hydraulic lines",
                    "Check steering pivot points at engine for corrosion/binding",
                    "Mercury: check pivot tube and tilt tube grease fittings",
                    "Yamaha: check swivel bracket grease points"
                ],
                options: [
                    { label: "Low fluid / needs bleeding", next: "ts_fix_bleed" },
                    { label: "Seized pivot points — needs greasing", next: "ts_fix_grease" },
                    { label: "Kinked steering line", next: "ts_fix_steer_line" },
                    { label: "Steering cylinder leaking", next: "ts_fix_steer_cyl" }
                ]
            },

            ts_loose_steering: {
                id: "ts_loose_steering",
                type: "instruction",
                text: "Steering has excessive play or feels loose.",
                checklist: [
                    "Check steering link rod end connections — worn ball joints?",
                    "Check drag link and tie bar (multi-engine) for play",
                    "Check hydraulic helm pump for internal wear",
                    "Check engine mount bolts — loose mounts allow movement",
                    "Air in system gives spongy feel"
                ],
                options: [
                    { label: "Worn link rod / ball joint", next: "ts_fix_link" },
                    { label: "Air in system — needs bleeding", next: "ts_fix_bleed" },
                    { label: "Worn helm pump (internal bypass)", next: "ts_fix_helm_pump" },
                    { label: "Loose engine mounts", next: "ts_fix_mounts" }
                ]
            },

            // TRIM & STEERING RESOLUTIONS
            ts_fix_breaker: { id: "ts_fix_breaker", type: "resolution", severity: "LOW", title: "Trim Breaker/Fuse", text: "Trim circuit breaker tripped or fuse blown.", action: "Reset breaker. If it trips again immediately, check for seized motor or short circuit. Do NOT keep resetting.", partsNeeded: ["Replacement fuse if applicable"], estimatedTime: "5-30 minutes" },

            ts_fix_switch: { id: "ts_fix_switch", type: "resolution", severity: "LOW", title: "Trim Switch Replacement", text: "Trim switch or wiring failed.", action: "Replace trim switch. Clean connector pins. Test both directions.", partsNeeded: ["Trim switch assembly"], estimatedTime: "30-60 minutes" },

            ts_fix_relay: { id: "ts_fix_relay", type: "resolution", severity: "MEDIUM", title: "Trim Relay/Solenoid", text: "Trim relay has failed.", action: "Replace relay. Clean all connections. Test both directions.", partsNeeded: ["Trim relay/solenoid"], estimatedTime: "30-60 minutes" },

            ts_fix_motor: { id: "ts_fix_motor", type: "resolution", severity: "MEDIUM", title: "Trim Pump Motor", text: "Trim pump motor has failed.", action: "Replace trim motor. Refill hydraulic fluid. Bleed system. Test operation.", partsNeeded: ["Trim/tilt pump motor", "Trim fluid"], estimatedTime: "1-3 hours" },

            ts_fix_fluid: { id: "ts_fix_fluid", type: "resolution", severity: "LOW", title: "Trim Fluid Low", text: "Hydraulic fluid is low.", action: "Fill to proper level (typically Dexron ATF — check spec). Cycle trim fully up and down several times to purge air. Top off again. FIND THE LEAK — fluid doesn't evaporate.", partsNeeded: ["Trim/tilt hydraulic fluid"], estimatedTime: "15-30 minutes" },

            ts_fix_seals: { id: "ts_fix_seals", type: "resolution", severity: "MEDIUM", title: "Trim Ram Seals", text: "Trim ram seals are leaking.", action: "Remove trim ram. Replace ALL seals in the kit. Clean surfaces. Refill and bleed. Replace BOTH rams at the same time.", partsNeeded: ["Trim/tilt ram seal kit", "Trim fluid"], estimatedTime: "2-4 hours" },

            ts_fix_pump: { id: "ts_fix_pump", type: "resolution", severity: "HIGH", title: "Trim Pump Assembly", text: "Internal hydraulic pump failure.", action: "Replace pump assembly. Refill with correct fluid. Bleed completely. Test full range.", partsNeeded: ["Trim/tilt pump assembly"], estimatedTime: "2-4 hours" },

            ts_fix_sender: { id: "ts_fix_sender", type: "resolution", severity: "LOW", title: "Trim Position Sender", text: "Trim sender giving wrong position reading.", action: "Replace sender. Calibrate with scan tool if required. Verify reading through full range.", partsNeeded: ["Trim position sender"], estimatedTime: "30-60 minutes" },

            ts_fix_flush: { id: "ts_fix_flush", type: "resolution", severity: "LOW", title: "Trim Fluid Flush", text: "Old contaminated fluid needs replacing.", action: "Drain old fluid. Cycle rams to expel remaining. Refill with fresh fluid. Cycle multiple times and top off.", partsNeeded: ["Trim fluid (2 quarts typical)"], estimatedTime: "45-90 minutes" },

            ts_fix_bleed: { id: "ts_fix_bleed", type: "resolution", severity: "LOW", title: "Steering System Bleed", text: "Air in hydraulic steering lines.", action: "Fill helm pump reservoir. Turn wheel lock-to-lock many times. Top off repeatedly until no bubbles and steering feels firm.", partsNeeded: ["Hydraulic steering fluid (Seastar/Teleflex type)"], estimatedTime: "30-60 minutes" },

            ts_fix_grease: { id: "ts_fix_grease", type: "resolution", severity: "LOW", title: "Steering Pivot Greasing", text: "Pivot points are corroded and binding.", action: "Grease all pivot points and tilt tube per maintenance schedule. Mercury: typically 6 grease points. Yamaha: similar — check manual.", partsNeeded: ["Marine waterproof grease", "Grease gun"], estimatedTime: "20-30 minutes" },

            ts_fix_steer_line: { id: "ts_fix_steer_line", type: "resolution", severity: "MEDIUM", title: "Steering Line Issue", text: "Kinked or restricted steering hydraulic line.", action: "Replace the damaged line. Use correct rated hydraulic hose. Refill and bleed entire system.", partsNeeded: ["Hydraulic steering hose", "Steering fluid"], estimatedTime: "1-3 hours" },

            ts_fix_steer_cyl: { id: "ts_fix_steer_cyl", type: "resolution", severity: "HIGH", title: "Steering Cylinder", text: "Hydraulic steering cylinder leaking or failed.", action: "Replace or reseal cylinder. Refill and bleed entire steering system. Test full range.", partsNeeded: ["Steering cylinder or seal kit", "Steering fluid"], estimatedTime: "2-4 hours" },

            ts_fix_link: { id: "ts_fix_link", type: "resolution", severity: "MEDIUM", title: "Steering Link/Tie Bar", text: "Worn steering link rod end or tie bar.", action: "Replace worn components. Torque to spec. New cotter pins (never reuse). Check alignment.", partsNeeded: ["Steering link rod end(s)", "Cotter pins"], estimatedTime: "1-2 hours" },

            ts_fix_helm_pump: { id: "ts_fix_helm_pump", type: "resolution", severity: "HIGH", title: "Helm Pump Worn", text: "Hydraulic helm pump has internal bypass causing loose steering.", action: "Replace helm pump. Drain system, remove old pump, install new, refill and bleed entire system.", partsNeeded: ["Hydraulic helm pump (Seastar/Teleflex)", "Steering fluid"], estimatedTime: "2-4 hours" },

            ts_fix_mounts: { id: "ts_fix_mounts", type: "resolution", severity: "MEDIUM", title: "Engine Mount Bolts", text: "Loose engine mounting hardware.", action: "Inspect all mounting bolts. Torque to spec. Check mount bushings for cracking or compression.", partsNeeded: ["Replacement mount bushings if worn"], estimatedTime: "30-60 minutes" }
        }
    },

    // =============================================
    // TREE 6: ELECTRONICS / MFD / GAUGES
    // =============================================
    electronics: {
        title: "Electronics / MFD / Gauges",
        requiredTools: [
            "DMM",
            "NMEA 2000 Terminator Resistors",
            "Dielectric Grease"
        ],
        startNode: "el_start",
        nodes: {

            el_start: {
                id: "el_start",
                type: "question",
                text: "Which electronic device is having issues?",
                options: [
                    { label: "MFD / Chartplotter won't turn on", next: "el_mfd_dead" },
                    { label: "MFD on but touchscreen not responding", next: "el_touch" },
                    { label: "No GPS fix / position wrong", next: "el_gps" },
                    { label: "Fishfinder / sonar not working", next: "el_sonar" },
                    { label: "VHF radio issues", next: "el_vhf" },
                    { label: "Engine data not showing on display", next: "el_engine_data" },
                    { label: "NMEA 2000 network problems", next: "el_nmea" }
                ]
            },

            el_mfd_dead: {
                id: "el_mfd_dead",
                type: "instruction",
                text: "MFD won't power on. Check the power supply:",
                measurement: { label: "Voltage at MFD Power Connector", unit: "VDC", expectedRange: "12.0 or higher" },
                checklist: [
                    "Check power cable at back of unit — push in firmly",
                    "Measure voltage at MFD power connector (most need 10-32VDC)",
                    "Check fuse for MFD circuit (typically 3-10A)",
                    "Check breaker panel — is MFD breaker ON?",
                    "Try holding power button 5+ seconds",
                    "Check ground wire connection"
                ],
                options: [
                    { label: "No voltage — blown fuse or wiring", next: "el_mfd_no_power" },
                    { label: "Voltage good but unit still dead", next: "el_mfd_dead_power_ok" },
                    { label: "Low voltage (under 10V)", next: "fix_battery" }
                ]
            },

            el_mfd_no_power: {
                id: "el_mfd_no_power",
                type: "instruction",
                text: "No voltage at MFD. Trace the circuit:",
                checklist: [
                    "Check and replace fuse if blown",
                    "Check breaker panel",
                    "Trace positive wire from MFD back to panel",
                    "Check ground wire continuity to ground bus"
                ],
                options: [
                    { label: "Blown fuse — replaced", next: "fix_simple" },
                    { label: "Wiring issue", next: "fix_wiring" },
                    { label: "Corroded connector at MFD", next: "fix_connector" }
                ]
            },

            el_mfd_dead_power_ok: {
                id: "el_mfd_dead_power_ok",
                type: "instruction",
                text: "MFD has proper voltage but won't power on.",
                checklist: [
                    "Disconnect power for 30 seconds, reconnect (hard reset)",
                    "Check for a reset pinhole button on the back",
                    "Shine flashlight at screen — look for faint image (backlight dead but unit is on)",
                    "Check for water intrusion in connector",
                    "Check if stuck in boot loop from bad update"
                ],
                options: [
                    { label: "Hard reset worked", next: "fix_simple" },
                    { label: "Screen on but backlight dead", next: "el_fix_mfd_replace" },
                    { label: "Water damage found", next: "el_fix_mfd_replace" },
                    { label: "Unit is dead — needs replacement", next: "el_fix_mfd_replace" }
                ]
            },

            el_touch: {
                id: "el_touch",
                type: "instruction",
                text: "MFD on but touchscreen not responding.",
                checklist: [
                    "Clean screen with microfiber cloth — salt film blocks capacitive touch",
                    "Dry hands — wet fingers cause issues on some screens",
                    "Try touchscreen recalibration from settings (use buttons if available)",
                    "Check for software update",
                    "Dry water droplets — causes phantom touches"
                ],
                options: [
                    { label: "Cleaning fixed it", next: "fix_simple" },
                    { label: "Recalibration fixed it", next: "fix_simple" },
                    { label: "Still not responding — hardware failure", next: "el_fix_mfd_replace" }
                ]
            },

            el_gps: {
                id: "el_gps",
                type: "instruction",
                text: "GPS not getting a fix or position is wrong.",
                checklist: [
                    "Internal or external GPS antenna?",
                    "External: check cable connections at MFD and antenna",
                    "Antenna needs clear sky view — not blocked by hardtop, radar arch",
                    "Check antenna cable for damage or kinks",
                    "Cold start after long storage can take 5-15 minutes",
                    "Try GPS reset from MFD settings"
                ],
                options: [
                    { label: "Loose cable — reconnected", next: "fix_simple" },
                    { label: "Damaged antenna cable", next: "el_fix_cable" },
                    { label: "Antenna blocked — needs relocation", next: "el_fix_antenna_loc" },
                    { label: "Just needed cold-start time", next: "fix_simple" },
                    { label: "Antenna or internal receiver failed", next: "el_fix_gps_antenna" }
                ]
            },

            el_sonar: {
                id: "el_sonar",
                type: "question",
                text: "What is the sonar/fishfinder issue?",
                options: [
                    { label: "No sonar display at all", next: "el_sonar_dead" },
                    { label: "Sonar noisy or erratic", next: "el_sonar_noisy" },
                    { label: "Loses bottom at speed", next: "el_sonar_speed" }
                ]
            },

            el_sonar_dead: {
                id: "el_sonar_dead",
                type: "instruction",
                text: "No sonar data on screen.",
                checklist: [
                    "Is the correct sonar source selected on MFD?",
                    "Check transducer cable at MFD or sonar module",
                    "Check cable for damage — often pinched during trailering",
                    "Check transducer compatibility with head unit"
                ],
                options: [
                    { label: "Wrong source selected", next: "fix_simple" },
                    { label: "Loose or damaged transducer cable", next: "el_fix_cable" },
                    { label: "Transducer dead — needs replacement", next: "el_fix_transducer" }
                ]
            },

            el_sonar_noisy: {
                id: "el_sonar_noisy",
                type: "instruction",
                text: "Sonar showing noise, clutter, or erratic readings.",
                checklist: [
                    "Is noise present at rest (boat not moving)?",
                    "Turn off other electronics one at a time — see if noise stops",
                    "Check transducer for marine growth / barnacles",
                    "Check transducer cable isn't running parallel to power cables",
                    "Try reducing sonar sensitivity/gain",
                    "Check grounding — transducer should go to common ground bus"
                ],
                options: [
                    { label: "Electrical interference — found source", next: "el_fix_interference" },
                    { label: "Marine growth on transducer", next: "el_fix_clean_xducer" },
                    { label: "Cable routing issue", next: "el_fix_reroute" },
                    { label: "Ground loop", next: "fix_ground" }
                ]
            },

            el_sonar_speed: {
                id: "el_sonar_speed",
                type: "instruction",
                text: "Loses bottom at speed. Almost always transducer mounting issue.",
                checklist: [
                    "Transducer must be in clean, non-turbulent water flow",
                    "Transom mount: must be at or slightly below hull bottom",
                    "Check for air being drawn across transducer face at speed",
                    "In-hull: check for air bubbles in epoxy fill"
                ],
                options: [
                    { label: "Mounting needs adjustment", next: "el_fix_xducer_mount" },
                    { label: "Air bubble issue", next: "el_fix_xducer_mount" }
                ]
            },

            el_vhf: {
                id: "el_vhf",
                type: "question",
                text: "What is the VHF radio issue?",
                options: [
                    { label: "Won't power on", next: "el_vhf_dead" },
                    { label: "Can receive but can't transmit", next: "el_vhf_no_tx" },
                    { label: "Poor reception / static", next: "el_vhf_poor_rx" }
                ]
            },

            el_vhf_dead: {
                id: "el_vhf_dead",
                type: "instruction",
                text: "VHF won't turn on.",
                checklist: [
                    "Check fuse for VHF circuit (typically 5-10A)",
                    "Check voltage at VHF power connector",
                    "Check inline fuse on VHF power lead (many have one built in)"
                ],
                options: [
                    { label: "Power issue — fixing", next: "fix_wiring" },
                    { label: "Power good — radio dead", next: "el_fix_vhf_replace" }
                ]
            },

            el_vhf_no_tx: {
                id: "el_vhf_no_tx",
                type: "instruction",
                text: "VHF receives but won't transmit. Usually antenna system problem.",
                checklist: [
                    "Check antenna cable connection at radio — tight?",
                    "Check cable connection at antenna",
                    "Inspect cable for damage or water intrusion",
                    "Check antenna itself — fiberglass antennas degrade over time",
                    "If available, test with SWR meter — should be below 2.0:1"
                ],
                options: [
                    { label: "Bad cable connection — fixed", next: "fix_simple" },
                    { label: "Damaged antenna cable", next: "el_fix_cable" },
                    { label: "Antenna failed", next: "el_fix_vhf_antenna" },
                    { label: "Antenna OK — radio transmitter failed", next: "el_fix_vhf_replace" }
                ]
            },

            el_vhf_poor_rx: {
                id: "el_vhf_poor_rx",
                type: "instruction",
                text: "Weak VHF reception. Same causes as transmit problems.",
                options: [
                    { label: "Check antenna system", next: "el_vhf_no_tx" }
                ]
            },

            el_engine_data: {
                id: "el_engine_data",
                type: "instruction",
                text: "Engine data (RPM, fuel flow, temp) not showing on MFD or gauges.",
                checklist: [
                    "Mercury: check SmartCraft bus cables from engine to helm",
                    "Yamaha: check Command Link cables from engine to gauges",
                    "Check engine gateway/interface module",
                    "Verify MFD is configured for correct engine data source",
                    "Check helm connector where engine harness meets boat harness",
                    "Multi-engine: both missing or just one?"
                ],
                options: [
                    { label: "Loose or corroded connector at helm", next: "fix_connector" },
                    { label: "Gateway module issue", next: "el_fix_gateway" },
                    { label: "MFD needs to be configured", next: "el_fix_config" },
                    { label: "Engine harness damaged", next: "fix_wiring" }
                ]
            },

            el_nmea: {
                id: "el_nmea",
                type: "instruction",
                text: "NMEA 2000 network problems. This network connects engine, GPS, MFD, instruments.",
                checklist: [
                    "Network needs terminators at EACH END (120 ohm each)",
                    "Measure backbone: disconnect all devices, measure NET-H to NET-L — should read 60 ohms",
                    "Check power on backbone: NET-C to NET-PWR should be about 12V",
                    "Check ALL T-connectors for corrosion",
                    "One bad device can kill the whole network"
                ],
                measurement: { label: "NMEA 2000 Backbone Resistance", unit: "Ohms", expectedRange: "60 (two 120-ohm terminators in parallel)" },
                options: [
                    { label: "Missing or bad terminator", next: "el_fix_terminator" },
                    { label: "Corroded T-connector", next: "el_fix_nmea_conn" },
                    { label: "No power on backbone", next: "el_fix_nmea_power" },
                    { label: "One device causing problems", next: "el_nmea_isolate" }
                ]
            },

            el_nmea_isolate: {
                id: "el_nmea_isolate",
                type: "instruction",
                text: "One bad device can kill the entire NMEA 2000 network. To find it:",
                checklist: [
                    "Disconnect ALL devices from backbone",
                    "Add devices back one at a time",
                    "After each device, check if network works",
                    "The device that kills the network when connected is the culprit"
                ],
                options: [
                    { label: "Found the bad device", next: "el_fix_nmea_device" },
                    { label: "All devices OK individually — backbone problem", next: "el_fix_nmea_conn" }
                ]
            },

            // ELECTRONICS RESOLUTIONS
            el_fix_mfd_replace: { id: "el_fix_mfd_replace", type: "resolution", severity: "HIGH", title: "MFD Replacement", text: "MFD unit has failed.", action: "Document model number and all connected accessories. New unit needs configuration: sonar, radar, engine sources, waypoints (import from SD backup). Check warranty (most: 2-3 years).", partsNeeded: ["Replacement MFD"], estimatedTime: "1-3 hours" },

            el_fix_cable: { id: "el_fix_cable", type: "resolution", severity: "MEDIUM", title: "Antenna/Signal Cable Replacement", text: "Signal cable is damaged.", action: "Replace cable run. VHF: use RG-213 coax preferred. GPS: manufacturer-spec cable. Route away from power cables. Seal hull penetrations.", partsNeeded: ["Appropriate cable for the device"], estimatedTime: "1-4 hours" },

            el_fix_antenna_loc: { id: "el_fix_antenna_loc", type: "resolution", severity: "LOW", title: "Antenna Relocation", text: "GPS antenna needs clear sky view.", action: "Relocate antenna to a position with clear view of the sky. Away from radar, metal structures.", partsNeeded: ["Antenna extension cable if needed", "Mounting hardware"], estimatedTime: "1-2 hours" },

            el_fix_gps_antenna: { id: "el_fix_gps_antenna", type: "resolution", severity: "MEDIUM", title: "GPS Antenna Replacement", text: "GPS antenna or internal receiver has failed.", action: "Replace external antenna. If internal GPS, unit may need replacement.", partsNeeded: ["GPS antenna (model-specific)"], estimatedTime: "30-60 minutes" },

            el_fix_transducer: { id: "el_fix_transducer", type: "resolution", severity: "MEDIUM", title: "Transducer Replacement", text: "Transducer has failed.", action: "Match replacement to sonar unit (frequency, type, connector). Install per manufacturer specs.", partsNeeded: ["Transducer (match to sonar unit)", "Mounting hardware", "Marine sealant if through-hull"], estimatedTime: "1-3 hours" },

            el_fix_interference: { id: "el_fix_interference", type: "resolution", severity: "LOW", title: "Electrical Interference Fixed", text: "Identified source of sonar interference.", action: "Reroute transducer cable away from power cables. Add ferrite chokes to cable near sonar unit. Ensure clean ground.", partsNeeded: ["Ferrite chokes", "Cable ties"], estimatedTime: "30-90 minutes" },

            el_fix_clean_xducer: { id: "el_fix_clean_xducer", type: "resolution", severity: "LOW", title: "Transducer Cleaning", text: "Marine growth on transducer face.", action: "Clean with soft cloth and marine growth remover. Do NOT use abrasive scrapers. Apply transducer-safe antifouling paint.", partsNeeded: ["Marine growth remover", "Transducer antifouling paint"], estimatedTime: "15-30 minutes" },

            el_fix_reroute: { id: "el_fix_reroute", type: "resolution", severity: "LOW", title: "Cable Rerouting", text: "Signal cable running too close to power cables.", action: "Reroute signal cables at least 12 inches from power cables. Cross at 90 degrees if they must cross. Use cable conduit.", estimatedTime: "30-60 minutes" },

            el_fix_xducer_mount: { id: "el_fix_xducer_mount", type: "resolution", severity: "MEDIUM", title: "Transducer Mounting Adjustment", text: "Transducer mounting causing loss of signal at speed.", action: "Adjust or relocate transducer for clean water flow. Transom mount: at or slightly below hull. Ensure no air entrainment at speed.", estimatedTime: "1-2 hours" },

            el_fix_vhf_replace: { id: "el_fix_vhf_replace", type: "resolution", severity: "HIGH", title: "VHF Radio Replacement", text: "VHF radio has failed.", action: "Replace radio. Program MMSI number. Test transmit and receive. Verify DSC. Ensure GPS input for DSC position.", warning: "VHF is SAFETY EQUIPMENT. Ensure it works before customer goes out.", partsNeeded: ["VHF radio", "Mounting hardware"], estimatedTime: "1-2 hours" },

            el_fix_vhf_antenna: { id: "el_fix_vhf_antenna", type: "resolution", severity: "MEDIUM", title: "VHF Antenna Replacement", text: "VHF antenna element has degraded.", action: "Install new antenna at highest practical point. Use RG-213 coax. Solder PL-259 connectors. Seal exterior connections. Test SWR.", partsNeeded: ["VHF antenna (8ft typical)", "RG-213 coax", "PL-259 connectors"], estimatedTime: "1-3 hours" },

            el_fix_gateway: { id: "el_fix_gateway", type: "resolution", severity: "HIGH", title: "Engine Gateway Module", text: "Engine interface/gateway module issue.", action: "Replace gateway. Mercury: may need CDS G3 to configure. Yamaha: typically auto-configures. Verify all engine data populates after install.", partsNeeded: ["Gateway module (Mercury SmartCraft or Yamaha Command Link)"], estimatedTime: "1-2 hours" },

            el_fix_config: { id: "el_fix_config", type: "resolution", severity: "LOW", title: "MFD Configuration", text: "MFD needs to be configured for engine data.", action: "Go to MFD settings and select engine data source. Garmin: Settings > Communications. Simrad/Lowrance: Settings > Network. Raymarine: Settings > Network.", estimatedTime: "15-30 minutes" },

            el_fix_terminator: { id: "el_fix_terminator", type: "resolution", severity: "LOW", title: "NMEA 2000 Terminator", text: "Network missing terminators.", action: "Install 120-ohm terminators at BOTH ends of backbone (exactly 2 total). Verify 60 ohms across backbone. Power cycle.", partsNeeded: ["NMEA 2000 terminators (120 ohm)"], estimatedTime: "15-30 minutes" },

            el_fix_nmea_conn: { id: "el_fix_nmea_conn", type: "resolution", severity: "MEDIUM", title: "NMEA 2000 Connector Repair", text: "Corroded network connector.", action: "Replace corroded T-connectors or drop cables. Apply dielectric grease. Consider relocating connections out of wet areas.", partsNeeded: ["NMEA 2000 T-connectors", "Drop cables", "Dielectric grease"], estimatedTime: "30-60 minutes" },

            el_fix_nmea_power: { id: "el_fix_nmea_power", type: "resolution", severity: "MEDIUM", title: "NMEA 2000 Power Issue", text: "No power on the NMEA 2000 backbone.", action: "Check the NMEA 2000 power cable connection. Typically a red/black pair that connects to 12V. Check fuse. Verify 12V between NET-C and NET-PWR.", partsNeeded: ["NMEA 2000 power cable if damaged"], estimatedTime: "30-60 minutes" },

            el_fix_nmea_device: { id: "el_fix_nmea_device", type: "resolution", severity: "MEDIUM", title: "Failed NMEA 2000 Device", text: "One device is taking down the network.", action: "Replace the failed device. Reconnect and verify entire network communicates.", estimatedTime: "30-60 minutes plus device cost" }
}
    },

    // =============================================
    // TREE 7: MARINE STEREO / AUDIO
    // =============================================
    stereo_audio: {
        title: "Marine Stereo / Audio System",
        requiredTools: [
            "DMM",
            "12V Test Light",
            "Wire Strippers",
            "Heat Shrink Kit"
        ],
        startNode: "st_start",
        nodes: {

            st_start: {
                id: "st_start",
                type: "question",
                text: "What is the stereo or audio problem?",
                options: [
                    { label: "Stereo won't turn on at all", next: "st_no_power" },
                    { label: "Stereo turns on but no sound from any speaker", next: "st_no_sound" },
                    { label: "Sound from some speakers but not all", next: "st_partial_sound" },
                    { label: "Sound is distorted, crackling, or cutting out", next: "st_distorted" },
                    { label: "Stereo turns on and off randomly", next: "st_intermittent" },
                    { label: "Bluetooth won't connect or drops", next: "st_bluetooth" },
                    { label: "Stereo draining battery when boat is off", next: "st_parasitic" },
                    { label: "Subwoofer or amplifier not working", next: "st_amp" }
                ]
            },

            // ========================================
            // NO POWER
            // ========================================
            st_no_power: {
                id: "st_no_power",
                type: "instruction",
                text: "Stereo completely dead. Check the power supply:",
                measurement: { label: "Voltage at Stereo Harness", unit: "VDC", expectedRange: "12.0 or higher" },
                checklist: [
                    "Check the fuse for the stereo circuit on the boat's fuse panel (typically 10-15A)",
                    "Check for an INLINE fuse on the stereo's own power wire (many head units have one built in near the connector)",
                    "Measure voltage at the stereo harness — there should be TWO 12V wires: one constant (memory/clock) and one switched (turns on with ignition or accessory switch)",
                    "Check ground wire — must be connected to a clean ground point",
                    "Is the stereo on a switched circuit that requires the ignition key to be ON?"
                ],
                options: [
                    { label: "Blown fuse on panel", next: "st_fix_fuse" },
                    { label: "Blown inline fuse on stereo wire", next: "st_fix_inline_fuse" },
                    { label: "No voltage at harness — wiring problem", next: "st_fix_wiring" },
                    { label: "Stereo is on switched circuit — only works with key ON", next: "st_fix_switched" },
                    { label: "Voltage and ground are good — stereo itself is dead", next: "st_fix_head_unit" }
                ]
            },

            // ========================================
            // NO SOUND
            // ========================================
            st_no_sound: {
                id: "st_no_sound",
                type: "instruction",
                text: "Stereo powers on and displays but no sound from any speaker.",
                checklist: [
                    "Check volume — sounds obvious but some stereos have separate zone volumes",
                    "Check if the stereo is MUTED (some have a mute button or setting)",
                    "Check if FADE or BALANCE is turned all the way to one side",
                    "Check if the correct SOURCE is selected (AM/FM, Bluetooth, AUX, etc.)",
                    "Try a different source — if AUX doesn't work, try FM radio",
                    "Check speaker wires at the back of the stereo — corroded or disconnected?"
                ],
                options: [
                    { label: "Was muted or wrong source — fixed", next: "fix_simple" },
                    { label: "Fade/balance was wrong — fixed", next: "fix_simple" },
                    { label: "No sound on ANY source — speaker wire issue", next: "st_check_speakers" },
                    { label: "One source works but another doesn't", next: "st_source_issue" }
                ]
            },

            st_check_speakers: {
                id: "st_check_speakers",
                type: "instruction",
                text: "No sound from any speaker on any source. Problem is between the stereo output and the speakers.",
                checklist: [
                    "Disconnect a speaker wire pair from the back of the stereo",
                    "Set your DMM to OHMS and measure across the speaker wire pair",
                    "A good speaker should read 2-8 ohms",
                    "If reading 0 ohms — speaker wire is shorted (wires touching each other)",
                    "If reading infinite/OL — wire is broken or speaker is disconnected",
                    "If speaker reads OK, the stereo's internal amplifier may have failed"
                ],
                measurement: { label: "Speaker Impedance", unit: "Ohms", expectedRange: "2-8 ohms per speaker" },
                options: [
                    { label: "Shorted speaker wire (0 ohms)", next: "st_fix_speaker_wire" },
                    { label: "Open circuit (no reading) — broken wire", next: "st_fix_speaker_wire" },
                    { label: "Speakers measure OK — stereo amp is dead", next: "st_fix_head_unit" },
                    { label: "All speakers read bad — they're all blown", next: "st_fix_speakers" }
                ]
            },

            st_source_issue: {
                id: "st_source_issue",
                type: "instruction",
                text: "Some sources work, others don't. The speakers are fine — source input is the issue.",
                checklist: [
                    "Bluetooth no sound: unpair all devices and re-pair",
                    "AUX no sound: try a different AUX cable, try a different phone/device",
                    "AM/FM no sound: check antenna connection on back of stereo",
                    "USB no sound: try a different USB cable, try a different device"
                ],
                options: [
                    { label: "Bluetooth issue — see Bluetooth section", next: "st_bluetooth" },
                    { label: "Bad AUX cable", next: "fix_simple" },
                    { label: "AM/FM antenna disconnected or damaged", next: "st_fix_antenna" },
                    { label: "USB port dead on stereo", next: "st_fix_head_unit" }
                ]
            },

            // ========================================
            // PARTIAL SOUND
            // ========================================
            st_partial_sound: {
                id: "st_partial_sound",
                type: "instruction",
                text: "Some speakers work but others don't. Need to isolate which ones are dead.",
                checklist: [
                    "Use the stereo's FADE and BALANCE controls to send sound to each speaker zone individually",
                    "Identify exactly which speakers are dead",
                    "Are the dead speakers all on the same side? Same zone? Same amp channel?",
                    "Check wiring to the dead speaker(s) — pull the speaker grille and look at the wire connections",
                    "Check for water damage on the dead speaker(s) — corroded terminals or cone damage"
                ],
                options: [
                    { label: "One speaker dead — bad speaker", next: "st_single_speaker" },
                    { label: "One whole side dead (left or right) — stereo channel or wiring", next: "st_one_side" },
                    { label: "Front or rear zone dead — zone wiring", next: "st_zone_dead" },
                    { label: "All speakers on external amp are dead", next: "st_amp" }
                ]
            },

            st_single_speaker: {
                id: "st_single_speaker",
                type: "instruction",
                text: "Single speaker not working. Check the speaker itself:",
                checklist: [
                    "Remove the speaker grille",
                    "Check wire connections at the speaker — corroded? Disconnected?",
                    "Look at the speaker cone — water damage, torn, rusted?",
                    "Measure speaker with DMM — should read 2-8 ohms across terminals",
                    "If speaker reads OK, check the wire run back to the stereo"
                ],
                options: [
                    { label: "Loose or corroded wire at speaker", next: "st_fix_speaker_conn" },
                    { label: "Speaker is blown or water damaged", next: "st_fix_speakers" },
                    { label: "Speaker reads OK — wire is broken somewhere", next: "st_fix_speaker_wire" }
                ]
            },

            st_one_side: {
                id: "st_one_side",
                type: "instruction",
                text: "All speakers on one side (left or right) are dead.",
                checklist: [
                    "Check BALANCE control — make sure it isn't panned to one side",
                    "If balance is centered, the stereo channel for that side may have failed",
                    "Check wiring at the back of the stereo for that channel — loose?",
                    "If running through an amplifier, that amp channel may be dead"
                ],
                options: [
                    { label: "Balance was off — fixed", next: "fix_simple" },
                    { label: "Loose wiring at stereo", next: "st_fix_speaker_wire" },
                    { label: "Stereo channel dead — internal failure", next: "st_fix_head_unit" },
                    { label: "Amp channel dead", next: "st_fix_amp" }
                ]
            },

            st_zone_dead: {
                id: "st_zone_dead",
                type: "instruction",
                text: "An entire zone is dead (like cockpit speakers or tower speakers).",
                checklist: [
                    "Check the zone volume/control on the stereo — some zones have separate volume",
                    "Check zone output wiring at the stereo",
                    "If zone goes through a separate amp, check that amp",
                    "Check wiring junction/distribution point for that zone"
                ],
                options: [
                    { label: "Zone volume was turned down", next: "fix_simple" },
                    { label: "Wiring issue to that zone", next: "st_fix_speaker_wire" },
                    { label: "Zone amplifier problem", next: "st_amp" }
                ]
            },

            // ========================================
            // DISTORTED SOUND
            // ========================================
            st_distorted: {
                id: "st_distorted",
                type: "question",
                text: "What kind of sound problem?",
                options: [
                    { label: "Crackling or static at all volumes", next: "st_crackling" },
                    { label: "Distortion only at high volume", next: "st_loud_distortion" },
                    { label: "Sound cuts in and out", next: "st_cuts_out" },
                    { label: "Whine or buzz that changes with engine RPM", next: "st_engine_noise" }
                ]
            },

            st_crackling: {
                id: "st_crackling",
                type: "instruction",
                text: "Crackling or static at all volumes. Usually a connection or speaker problem.",
                checklist: [
                    "Wiggle the wires at the back of the stereo while playing — does crackling change?",
                    "Check each speaker connection — corroded terminals cause crackling",
                    "Check for water damage on speaker cones",
                    "Try unplugging speakers one at a time — when crackling stops, that's the bad one",
                    "Check the ground wire — a poor ground causes all kinds of noise"
                ],
                options: [
                    { label: "Loose connection at stereo — fixed", next: "fix_simple" },
                    { label: "Corroded speaker connection", next: "st_fix_speaker_conn" },
                    { label: "Water-damaged speaker", next: "st_fix_speakers" },
                    { label: "Bad ground", next: "fix_ground" }
                ]
            },

            st_loud_distortion: {
                id: "st_loud_distortion",
                type: "instruction",
                text: "Distortion only at higher volume. Usually speakers or gain settings.",
                checklist: [
                    "Is the stereo's internal amp trying to drive too many speakers?",
                    "Check gain settings if running an external amp — too high causes clipping",
                    "Speakers may be undersized for the volume level",
                    "Check speaker cones for damage — a torn cone distorts at volume",
                    "If using a subwoofer amp, check that the bass boost isn't maxed out"
                ],
                options: [
                    { label: "Amp gain too high — adjusted", next: "fix_simple" },
                    { label: "Speakers damaged from over-driving", next: "st_fix_speakers" },
                    { label: "Need an external amp to drive speakers properly", next: "st_fix_add_amp" },
                    { label: "Bass boost too high — adjusted", next: "fix_simple" }
                ]
            },

            st_cuts_out: {
                id: "st_cuts_out",
                type: "instruction",
                text: "Sound cuts in and out. Usually a connection issue.",
                checklist: [
                    "Check all wiring connections — loose connections cause intermittent dropout",
                    "Is it related to boat movement or vibration? If so, a wire is barely connected",
                    "Check for corroded connectors",
                    "If using Bluetooth — see Bluetooth section",
                    "Check stereo power wire — voltage dropping can cause reset/cutout",
                    "Check if stereo is going into protect mode (some flash a warning)"
                ],
                options: [
                    { label: "Loose connection found — secured", next: "fix_simple" },
                    { label: "Corroded connector", next: "fix_connector" },
                    { label: "Bluetooth dropout", next: "st_bluetooth" },
                    { label: "Stereo going into protect mode", next: "st_protect_mode" }
                ]
            },

            st_engine_noise: {
                id: "st_engine_noise",
                type: "instruction",
                text: "Whine or buzz that changes with engine RPM. This is alternator noise getting into the audio system.",
                checklist: [
                    "Noise changes with RPM = electrical noise from the charging system",
                    "Check stereo ground — must go to a dedicated ground point, NOT shared with engine ground",
                    "Check if stereo power wire runs parallel to engine wiring — separate them",
                    "Check for a ground loop — stereo and amp grounded at different points",
                    "Try a noise filter/isolator on the stereo power wire"
                ],
                options: [
                    { label: "Fixed ground — noise gone", next: "fix_simple" },
                    { label: "Rerouted power wire away from engine wiring", next: "fix_simple" },
                    { label: "Need a noise filter/isolator", next: "st_fix_noise_filter" }
                ]
            },

            st_protect_mode: {
                id: "st_protect_mode",
                type: "instruction",
                text: "Stereo or amp going into protection mode. Protection mode activates when something is wrong.",
                checklist: [
                    "Check for a shorted speaker wire — most common cause of protect mode",
                    "Disconnect ALL speaker wires and power up — if protect mode clears, a speaker or wire is shorted",
                    "Reconnect speakers one at a time to find the short",
                    "Check that speaker impedance isn't too low (too many speakers on one channel)",
                    "Check amp for overheating — needs ventilation"
                ],
                options: [
                    { label: "Found shorted speaker wire", next: "st_fix_speaker_wire" },
                    { label: "Speaker impedance too low — too many speakers per channel", next: "st_fix_impedance" },
                    { label: "Amp overheating — needs better ventilation", next: "st_fix_amp_heat" },
                    { label: "Protect mode even with nothing connected — amp/stereo failed", next: "st_fix_head_unit" }
                ]
            },

            // ========================================
            // INTERMITTENT ON/OFF
            // ========================================
            st_intermittent: {
                id: "st_intermittent",
                type: "instruction",
                text: "Stereo turns on and off randomly or reboots itself.",
                checklist: [
                    "Check power connection — loose power wire causes resets",
                    "Check ground connection — intermittent ground causes all kinds of weirdness",
                    "Check voltage at the stereo while it's acting up — drops below 10V can reset it",
                    "Check if it coincides with something else turning on (bilge pump, blower, etc.) — voltage drop",
                    "Water intrusion into the stereo housing — marine stereos should be NMMA rated"
                ],
                options: [
                    { label: "Loose power or ground — fixed", next: "fix_simple" },
                    { label: "Voltage drop when other loads kick on", next: "st_fix_power_supply" },
                    { label: "Water intrusion", next: "st_fix_head_unit" },
                    { label: "Stereo has internal fault", next: "st_fix_head_unit" }
                ]
            },

            // ========================================
            // BLUETOOTH
            // ========================================
            st_bluetooth: {
                id: "st_bluetooth",
                type: "instruction",
                text: "Bluetooth connection issues.",
                checklist: [
                    "Delete/forget the stereo from your phone's Bluetooth list",
                    "On the stereo, clear paired devices if possible",
                    "Re-pair from scratch — put stereo in pairing mode",
                    "Make sure no one else's phone is auto-connecting to the stereo",
                    "Check if phone is too far from the stereo (Bluetooth range: about 30 feet)",
                    "Some stereos only pair with one device at a time",
                    "Try updating stereo firmware if available"
                ],
                options: [
                    { label: "Re-pairing fixed it", next: "fix_simple" },
                    { label: "Another phone was connecting — resolved", next: "fix_simple" },
                    { label: "Bluetooth module in stereo has failed", next: "st_fix_head_unit" }
                ]
            },

            // ========================================
            // PARASITIC DRAW
            // ========================================
            st_parasitic: {
                id: "st_parasitic",
                type: "instruction",
                text: "Stereo is draining the battery when the boat is off.",
                help: "Many marine stereos have a constant power wire (for memory/clock) that draws 50-200mA even when 'off'. Over days or weeks, this drains the battery.",
                checklist: [
                    "Measure current draw with stereo 'off' — disconnect the constant power wire and put your DMM in series",
                    "Normal standby draw: under 50mA. Some stereos draw much more.",
                    "If the stereo draws excessive standby power, it may not be going to sleep properly",
                    "The fix is usually to wire the stereo's constant power through the ignition switch or a dedicated switch"
                ],
                options: [
                    { label: "Normal draw but boat sits too long — add switch", next: "st_fix_add_switch" },
                    { label: "Stereo drawing excessive power when off — not sleeping", next: "st_fix_head_unit" },
                    { label: "Customer just needs a battery maintainer", next: "fix_maintainer" }
                ]
            },

            // ========================================
            // AMPLIFIER
            // ========================================
            st_amp: {
                id: "st_amp",
                type: "instruction",
                text: "External amplifier not working.",
                checklist: [
                    "Check amp power — 12V on the main power wire?",
                    "Check amp REMOTE TURN-ON wire — this 12V signal from the stereo tells the amp to turn on",
                    "Check amp ground — must be clean, tight connection",
                    "Check amp fuse (usually on the power wire near the battery)",
                    "Is the amp's POWER light on?",
                    "Check RCA signal cables from stereo to amp — loose? Corroded?",
                    "Check amp for overheating — should have air circulation"
                ],
                measurement: { label: "Voltage at Amp Power Terminal", unit: "VDC", expectedRange: "12.0 or higher" },
                options: [
                    { label: "No power at amp — fuse or wiring", next: "st_fix_amp_power" },
                    { label: "No remote turn-on signal", next: "st_fix_amp_remote" },
                    { label: "Power on but no output — bad RCA cables", next: "st_fix_amp_rca" },
                    { label: "Power on, signal in, but no output — amp failed", next: "st_fix_amp" },
                    { label: "Amp in protect mode", next: "st_protect_mode" },
                    { label: "Bad ground on amp", next: "fix_ground" }
                ]
            },

            // ========================================
            // STEREO RESOLUTIONS
            // ========================================
            st_fix_fuse: { id: "st_fix_fuse", type: "resolution", severity: "LOW", title: "Stereo Fuse Blown", text: "Fuse on the boat's panel for the stereo circuit is blown.", action: "Replace with same amperage fuse. If it blows again, there's a short in the stereo wiring — check for pinched wires, water in connectors, or a shorted speaker wire.", partsNeeded: ["Replacement fuse — same amperage"], estimatedTime: "5-15 minutes" },

            st_fix_inline_fuse: { id: "st_fix_inline_fuse", type: "resolution", severity: "LOW", title: "Inline Fuse Blown", text: "The inline fuse on the stereo's own power wire is blown.", action: "Replace the inline fuse. These are usually small blade fuses in a holder spliced into the power wire near the back of the stereo. Check the amperage — typically 10-15A.", partsNeeded: ["Inline blade fuse — match amperage"], estimatedTime: "5-10 minutes" },

            st_fix_wiring: { id: "st_fix_wiring", type: "resolution", severity: "MEDIUM", title: "Stereo Wiring Repair", text: "Power or speaker wiring is damaged.", action: "Repair with tinned marine wire. Use adhesive heat-shrink connectors. Route wires away from water, heat, and sharp edges. Use marine-rated wire only.", partsNeeded: ["Tinned marine wire", "Heat-shrink connectors", "Heat gun"], estimatedTime: "30-90 minutes" },

            st_fix_switched: { id: "st_fix_switched", type: "resolution", severity: "LOW", title: "Switched Power Circuit", text: "Stereo only works when ignition is on.", action: "If customer wants stereo without key on: add a dedicated switch for the stereo accessory wire, or rewire the accessory wire to a constant-hot circuit with its own fuse. Make sure the stereo still has a way to turn off to prevent battery drain.", partsNeeded: ["Toggle switch", "Fuse holder", "Marine wire"], estimatedTime: "30-60 minutes" },

            st_fix_head_unit: { id: "st_fix_head_unit", type: "resolution", severity: "HIGH", title: "Head Unit Replacement", text: "Marine stereo head unit has failed.", action: "Replace with a marine-rated stereo (Fusion, JL Audio, Kenwood Marine, Wet Sounds). Must be marine rated — regular car stereos will corrode quickly. Match wiring connections. Verify all zones and sources work after install.", partsNeeded: ["Marine-rated stereo head unit", "Wiring harness adapter if needed"], estimatedTime: "1-2 hours" },

            st_fix_speakers: { id: "st_fix_speakers", type: "resolution", severity: "MEDIUM", title: "Speaker Replacement", text: "Speaker(s) are blown or water damaged.", action: "Replace with marine-rated speakers matched to the stereo output power. Use marine-grade tinned wire. Seal any mounting holes. Apply dielectric grease to connections.", partsNeeded: ["Marine-rated speakers", "Tinned marine speaker wire", "Dielectric grease"], estimatedTime: "30-60 minutes per speaker" },

            st_fix_speaker_wire: { id: "st_fix_speaker_wire", type: "resolution", severity: "MEDIUM", title: "Speaker Wire Repair", text: "Speaker wiring is broken, shorted, or corroded.", action: "Run new tinned marine speaker wire. Do NOT splice old corroded wire — run a new full length. Keep speaker wire away from power cables. Use adhesive heat-shrink on all connections.", partsNeeded: ["Tinned marine speaker wire (16 AWG typical)", "Heat-shrink connectors"], estimatedTime: "30 min - 2 hours depending on routing" },

            st_fix_speaker_conn: { id: "st_fix_speaker_conn", type: "resolution", severity: "LOW", title: "Speaker Connection Repair", text: "Connection at the speaker is loose or corroded.", action: "Clean the speaker terminals. Install new connectors if needed. Apply dielectric grease. Make sure connection is tight and secure.", partsNeeded: ["Spade connectors or ring terminals", "Dielectric grease"], estimatedTime: "15-30 minutes" },

            st_fix_antenna: { id: "st_fix_antenna", type: "resolution", severity: "LOW", title: "AM/FM Antenna", text: "AM/FM antenna disconnected or damaged.", action: "Check the antenna cable connection at the back of the stereo. If the antenna cable is damaged, replace it. Most marine stereos use a standard Motorola-type antenna connector.", partsNeeded: ["AM/FM marine antenna if replacing"], estimatedTime: "15-60 minutes" },

            st_fix_noise_filter: { id: "st_fix_noise_filter", type: "resolution", severity: "LOW", title: "Noise Filter/Isolator", text: "Engine noise (alternator whine) in the audio system.", action: "Install a noise filter/isolator on the stereo power wire close to the stereo. Also check and fix the ground — a dedicated clean ground usually fixes this. If running an amp, it may need its own noise filter.", partsNeeded: ["12V noise filter/isolator", "Possibly ferrite chokes"], estimatedTime: "30-60 minutes" },

            st_fix_impedance: { id: "st_fix_impedance", type: "resolution", severity: "MEDIUM", title: "Speaker Impedance Mismatch", text: "Too many speakers wired to one channel, dropping impedance too low.", action: "Check total impedance per channel. Most amps are rated for 4 ohms minimum. Two 4-ohm speakers in parallel = 2 ohms = amp overloads and protects. Solutions: wire speakers in series instead of parallel, or add a separate amp channel.", partsNeeded: ["Possibly additional amplifier"], estimatedTime: "Consultation + possible rewire 1-3 hours" },

            st_fix_amp_heat: { id: "st_fix_amp_heat", type: "resolution", severity: "LOW", title: "Amplifier Overheating", text: "Amp shutting down from heat.", action: "Ensure amp has adequate air circulation. Do not mount in enclosed unventilated spaces. Consider adding a small 12V fan. Check that gain isn't set too high — clipping generates excess heat.", partsNeeded: ["12V cooling fan if needed"], estimatedTime: "30-60 minutes" },

            st_fix_amp_power: { id: "st_fix_amp_power", type: "resolution", severity: "MEDIUM", title: "Amplifier Power Issue", text: "No power reaching the amplifier.", action: "Check the amp power fuse (usually near the battery). Check the power wire from battery to amp — must be adequate gauge for the amp's draw. Check the ground wire — must be same gauge as power wire, connected to clean metal.", partsNeeded: ["Replacement fuse", "Power wire if needed"], estimatedTime: "30-60 minutes" },

            st_fix_amp_remote: { id: "st_fix_amp_remote", type: "resolution", severity: "LOW", title: "Amp Remote Turn-On Wire", text: "Amp not getting the signal to turn on.", action: "The remote wire is a small gauge wire (usually blue) from the stereo to the amp. Check for 12V on this wire when the stereo is on. Repair or run a new remote wire if damaged.", partsNeeded: ["Small gauge wire (18 AWG)"], estimatedTime: "20-45 minutes" },

            st_fix_amp_rca: { id: "st_fix_amp_rca", type: "resolution", severity: "LOW", title: "RCA Signal Cable Issue", text: "Signal not getting from stereo to amplifier.", action: "Check RCA cable connections at both ends. Replace with marine-grade RCA cables if corroded. Keep RCA cables away from power cables to prevent noise.", partsNeeded: ["Marine-grade RCA cables"], estimatedTime: "20-45 minutes" },

            st_fix_amp: { id: "st_fix_amp", type: "resolution", severity: "HIGH", title: "Amplifier Replacement", text: "Amplifier has failed internally.", action: "Replace with a marine-rated amplifier. Match power output to speakers. Use proper gauge power and ground wire. Fuse the power wire near the battery.", partsNeeded: ["Marine-rated amplifier", "Power wire", "Fuse holder", "RCA cables"], estimatedTime: "1-3 hours" },

            st_fix_add_amp: { id: "st_fix_add_amp", type: "resolution", severity: "LOW", title: "External Amplifier Recommended", text: "The stereo's internal amp can't adequately drive the speakers.", action: "Install an external marine-rated amplifier. This gives clean power to the speakers and lets the head unit just be the source/controller. Size the amp to match the speakers.", partsNeeded: ["Marine amplifier", "RCA cables", "Power wire", "Speaker wire", "Fuse holder"], estimatedTime: "2-4 hours" },

            st_fix_power_supply: { id: "st_fix_power_supply", type: "resolution", severity: "MEDIUM", title: "Stereo Power Supply Issue", text: "Voltage dropping when other loads turn on, causing stereo to reset.", action: "Run a dedicated power wire for the stereo directly from the battery (with a fuse). This isolates it from voltage drops caused by bilge pumps, blowers, etc. Use adequate wire gauge (12 AWG minimum).", partsNeeded: ["12 AWG marine wire", "Inline fuse holder", "15A fuse"], estimatedTime: "30-60 minutes" },

            st_fix_add_switch: { id: "st_fix_add_switch", type: "resolution", severity: "LOW", title: "Add Stereo Power Switch", text: "Customer needs a way to cut stereo power to prevent battery drain.", action: "Install a toggle switch or rocker switch on the stereo's power feed. This lets the customer kill the stereo completely when leaving the boat. Simple and effective.", partsNeeded: ["Marine-rated toggle or rocker switch", "Wire", "Connectors"], estimatedTime: "30-45 minutes" }
        }
    },

    // =============================================
    // TREE 8: NAVIGATION LIGHTS
    // =============================================
    nav_lights: {
        title: "Navigation Lights",
        requiredTools: [
            "DMM",
            "12V Test Light",
            "Replacement Bulbs (if not LED)"
        ],
        startNode: "nl_start",
        nodes: {

            nl_start: {
                id: "nl_start",
                type: "question",
                text: "What is the navigation light problem?",
                warning: "Navigation lights are REQUIRED BY LAW when operating between sunset and sunrise, and in restricted visibility. Fix these before the customer goes out.",
                options: [
                    { label: "No nav lights work at all", next: "nl_all_dead" },
                    { label: "Some lights work, some don't", next: "nl_partial" },
                    { label: "Lights are dim", next: "nl_dim" },
                    { label: "Anchor / all-round light not working", next: "nl_anchor" },
                    { label: "Stern light not working", next: "nl_single" },
                    { label: "Bow light (red/green) not working", next: "nl_single" },
                    { label: "Lights flicker or work intermittently", next: "nl_flicker" }
                ]
            },

            nl_all_dead: {
                id: "nl_all_dead",
                type: "instruction",
                text: "No navigation lights work at all. Problem is in the common power feed.",
                checklist: [
                    "Check the nav light breaker or fuse on the panel — is it ON? Blown?",
                    "Check the nav light switch — some boats have a separate nav light switch",
                    "Measure voltage at the nav light switch output with switch ON",
                    "Check for a common ground bus that all nav lights share — corroded?",
                    "Check the wiring from the switch/panel to the light distribution point"
                ],
                measurement: { label: "Voltage at Nav Light Switch (ON)", unit: "VDC", expectedRange: "12.0 or higher" },
                options: [
                    { label: "Blown fuse or tripped breaker", next: "nl_fix_fuse" },
                    { label: "Bad nav light switch", next: "nl_fix_switch" },
                    { label: "No voltage leaving the panel — wiring issue", next: "fix_wiring" },
                    { label: "Common ground corroded", next: "fix_ground" },
                    { label: "Voltage at switch is good — problem downstream", next: "nl_partial" }
                ]
            },

            nl_partial: {
                id: "nl_partial",
                type: "instruction",
                text: "Some lights work and some don't. The power feed is OK — problem is on individual light circuits.",
                checklist: [
                    "With nav lights turned ON, check for 12V at each non-working light's socket or connector",
                    "Check each bulb — burned out?",
                    "Check socket for corrosion (very common in marine environment)",
                    "Check the ground wire for each light",
                    "Check wiring from distribution point to each dead light"
                ],
                options: [
                    { label: "Burned out bulb(s)", next: "nl_fix_bulb" },
                    { label: "Corroded socket", next: "nl_fix_socket" },
                    { label: "No voltage at the light — broken wire", next: "nl_fix_wire" },
                    { label: "Bad ground at the light", next: "fix_ground" }
                ]
            },

            nl_single: {
                id: "nl_single",
                type: "instruction",
                text: "One specific light not working. Basic troubleshooting:",
                checklist: [
                    "Check bulb — remove and inspect. LED lights can also fail.",
                    "Check for 12V at the light socket with nav switch ON",
                    "Check socket for corrosion — green buildup on contacts",
                    "Check ground connection — trace the ground wire",
                    "Check for water inside the light housing — drain and dry"
                ],
                options: [
                    { label: "Bad bulb — replacing", next: "nl_fix_bulb" },
                    { label: "Corroded socket", next: "nl_fix_socket" },
                    { label: "No power at light — wire broken", next: "nl_fix_wire" },
                    { label: "Bad ground", next: "fix_ground" },
                    { label: "Water inside housing — LED corroded", next: "nl_fix_housing" }
                ]
            },

            nl_anchor: {
                id: "nl_anchor",
                type: "instruction",
                text: "Anchor light (all-round white light, usually on a pole at the stern or on the hardtop) not working.",
                checklist: [
                    "Is there a separate switch for the anchor light? (Many boats have a separate anchor light switch)",
                    "Check bulb or LED module",
                    "These lights are usually at the top of a pole — check the wire connections inside the pole base",
                    "Pull-up poles: check the contact points where the pole seats into the base — corrosion here is very common",
                    "Check for water intrusion at the top of the pole"
                ],
                options: [
                    { label: "Separate switch was off", next: "fix_simple" },
                    { label: "Bad bulb or LED", next: "nl_fix_bulb" },
                    { label: "Corroded pole base contacts", next: "nl_fix_pole" },
                    { label: "Wire broken inside pole", next: "nl_fix_pole" },
                    { label: "Water damage at top of pole", next: "nl_fix_housing" }
                ]
            },

            nl_dim: {
                id: "nl_dim",
                type: "instruction",
                text: "Navigation lights are dim.",
                checklist: [
                    "Check battery voltage — low battery = dim lights",
                    "Check for voltage drop: measure voltage at the battery, then at the light. Difference should be less than 0.5V.",
                    "Check all connections in the circuit for corrosion — corrosion = resistance = dim lights",
                    "If incandescent bulbs, they dim with age — replace",
                    "Check ground connections"
                ],
                options: [
                    { label: "Low battery voltage", next: "fix_battery" },
                    { label: "High voltage drop — corroded connection somewhere", next: "nl_fix_wire" },
                    { label: "Old incandescent bulbs — replacing", next: "nl_fix_bulb" },
                    { label: "Bad ground", next: "fix_ground" }
                ]
            },

            nl_flicker: {
                id: "nl_flicker",
                type: "instruction",
                text: "Lights flicker or work intermittently. Almost always a connection issue.",
                checklist: [
                    "Wiggle wires at each light while ON — does it flicker?",
                    "Check bulb seating in socket — loose bulb flickers",
                    "Check socket contacts — bent or corroded contacts make intermittent connection",
                    "Check all inline connectors on the light circuit",
                    "Check ground connections — intermittent ground = intermittent light"
                ],
                options: [
                    { label: "Loose bulb in socket", next: "nl_fix_bulb" },
                    { label: "Corroded socket contacts", next: "nl_fix_socket" },
                    { label: "Bad inline connector", next: "fix_connector" },
                    { label: "Intermittent ground", next: "fix_ground" },
                    { label: "Wire has a break that makes/loses contact", next: "nl_fix_wire" }
                ]
            },

            // NAV LIGHT RESOLUTIONS
            nl_fix_fuse: { id: "nl_fix_fuse", type: "resolution", severity: "LOW", title: "Nav Light Fuse/Breaker", text: "Nav light fuse blown or breaker tripped.", action: "Replace fuse with same amperage or reset breaker. If it blows again, there is a short circuit in the nav light wiring — find it before replacing the fuse again. Check for chafed wires, water in light housings, or corroded sockets.", partsNeeded: ["Replacement fuse"], estimatedTime: "5-30 minutes" },

            nl_fix_switch: { id: "nl_fix_switch", type: "resolution", severity: "MEDIUM", title: "Nav Light Switch Replacement", text: "Nav light switch has failed.", action: "Replace switch. Verify correct wiring. Test all lights after replacement.", partsNeeded: ["Replacement switch (match panel type)"], estimatedTime: "30-60 minutes" },

            nl_fix_bulb: { id: "nl_fix_bulb", type: "resolution", severity: "LOW", title: "Bulb or LED Replacement", text: "Bulb burned out or LED module failed.", action: "Replace bulb or LED with correct type. IMPORTANT: Nav lights must meet USCG specifications for brightness and color. Use only approved marine nav light bulbs. Consider upgrading incandescent to LED — they last much longer and draw less power.", help: "If converting to LED: the new LED must be USCG-approved for navigation use. Not all LED bulbs meet the brightness and visibility angle requirements.", partsNeeded: ["Replacement bulb or LED (USCG-approved if nav light)"], estimatedTime: "10-20 minutes" },

            nl_fix_socket: { id: "nl_fix_socket", type: "resolution", severity: "LOW", title: "Light Socket Cleaning/Replacement", text: "Light socket is corroded.", action: "Remove bulb. Clean socket contacts with fine sandpaper or electrical contact cleaner. Bend contacts slightly inward for better grip on bulb. Apply dielectric grease after cleaning. If socket is too far gone, replace the entire light fixture.", partsNeeded: ["Electrical contact cleaner", "Fine sandpaper", "Dielectric grease"], estimatedTime: "15-30 minutes" },

            nl_fix_wire: { id: "nl_fix_wire", type: "resolution", severity: "MEDIUM", title: "Nav Light Wiring Repair", text: "Wiring to the light is broken or has excessive resistance.", action: "Run new tinned marine wire to the light. Use adhesive heat-shrink connections. Route away from chafe points. Seal any deck or hull penetrations.", partsNeeded: ["Tinned marine wire (16 AWG typical for nav lights)", "Heat-shrink connectors", "Marine sealant"], estimatedTime: "30 min - 2 hours depending on routing" },

            nl_fix_housing: { id: "nl_fix_housing", type: "resolution", severity: "MEDIUM", title: "Light Housing / Fixture Replacement", text: "Light housing has water intrusion and internal corrosion.", action: "Replace the entire light fixture. Use marine sealant on mounting. Make sure the new fixture is rated for the location (bow, stern, masthead). Verify it meets USCG specs.", partsNeeded: ["Replacement nav light fixture (USCG approved)", "Marine sealant", "Stainless mounting hardware"], estimatedTime: "30-60 minutes" },

            nl_fix_pole: { id: "nl_fix_pole", type: "resolution", severity: "MEDIUM", title: "Anchor Light Pole Repair", text: "Anchor light pole has corroded contacts or broken internal wire.", action: "Clean the pole base contacts with fine sandpaper. Apply dielectric grease. Check internal wire by running continuity test from base to bulb socket. If wire is broken inside the pole, replace the pole. Check that the pole tip light housing is sealed.", partsNeeded: ["Dielectric grease", "Fine sandpaper", "Replacement pole if needed"], estimatedTime: "20-60 minutes" }
        }
    },

    // =============================================
    // TREE 9: HORN
    // =============================================
    horn_system: {
        title: "Horn Not Working",
        requiredTools: [
            "DMM",
            "12V Test Light"
        ],
        startNode: "hr_start",
        nodes: {

            hr_start: {
                id: "hr_start",
                type: "instruction",
                text: "Horn not working. This is REQUIRED SAFETY EQUIPMENT. Fix before customer goes out.",
                warning: "A sound-producing device is required by USCG regulations on all boats. This is not optional.",
                checklist: [
                    "Is this an electric horn (most common) or an air horn?",
                    "Locate the horn — usually under the console, behind the dash, or on the engine bracket",
                    "Locate the horn button — usually on the dash or throttle handle"
                ],
                options: [
                    { label: "Electric horn — completely dead", next: "hr_electric_dead" },
                    { label: "Horn makes a weak or distorted sound", next: "hr_weak" },
                    { label: "Horn works intermittently", next: "hr_intermittent" },
                    { label: "Horn sounds continuously / won't stop", next: "hr_stuck_on" }
                ]
            },

            hr_electric_dead: {
                id: "hr_electric_dead",
                type: "instruction",
                text: "Electric horn completely dead. Check the circuit:",
                checklist: [
                    "Check the horn fuse (typically 10-15A)",
                    "Press the horn button and check for 12V at the horn connector",
                    "Check the horn button — is it getting 12V on the input side?",
                    "Check ground connection at the horn",
                    "Try connecting 12V directly to the horn (bypass the button) — does it sound?",
                    "Check wiring from button to horn"
                ],
                measurement: { label: "Voltage at Horn Connector (Button Pressed)", unit: "VDC", expectedRange: "12.0 or higher" },
                options: [
                    { label: "Blown fuse", next: "hr_fix_fuse" },
                    { label: "No voltage at horn — button or wiring bad", next: "hr_check_button" },
                    { label: "12V at horn but horn doesn't sound — horn dead", next: "hr_fix_horn" },
                    { label: "Bad ground at horn", next: "fix_ground" },
                    { label: "Direct 12V makes it work — button circuit problem", next: "hr_check_button" }
                ]
            },

            hr_check_button: {
                id: "hr_check_button",
                type: "instruction",
                text: "Horn works when powered directly. Problem is the button or wiring to it.",
                checklist: [
                    "Check for 12V at the horn button input terminal",
                    "Press button — check for 12V at the output terminal",
                    "If 12V in but nothing out when pressed — button contacts are corroded or failed",
                    "Check wiring from button to horn for breaks or corrosion",
                    "Some horn circuits go through a relay — check the horn relay if equipped"
                ],
                options: [
                    { label: "No power to button — wiring from fuse panel", next: "fix_wiring" },
                    { label: "Button doesn't pass power — bad button", next: "hr_fix_button" },
                    { label: "Wire from button to horn is broken", next: "hr_fix_wire" },
                    { label: "Horn relay is bad", next: "hr_fix_relay" }
                ]
            },

            hr_weak: {
                id: "hr_weak",
                type: "instruction",
                text: "Horn sounds but is weak, quiet, or distorted.",
                checklist: [
                    "Check voltage at the horn while sounding — should be 12V+. Low voltage = weak horn.",
                    "Check the horn mounting — loose horn vibrates against the mount and sounds bad",
                    "Check for water inside the horn — drain it",
                    "Some horns have an adjustment screw on the back — try adjusting",
                    "Horn diaphragm may be cracked or corroded — inspect"
                ],
                options: [
                    { label: "Low voltage at horn — connection issue", next: "hr_fix_wire" },
                    { label: "Horn mounting loose — tightened", next: "fix_simple" },
                    { label: "Water inside horn — dried out", next: "fix_simple" },
                    { label: "Horn is corroded or damaged", next: "hr_fix_horn" }
                ]
            },

            hr_intermittent: {
                id: "hr_intermittent",
                type: "instruction",
                text: "Horn works sometimes but not always. Connection issue.",
                checklist: [
                    "Check the horn button contacts — spray with contact cleaner",
                    "Check wiring connections at the horn — loose or corroded",
                    "Check the ground at the horn",
                    "Wiggle wires while pressing horn button to find the bad connection",
                    "Check for corroded inline connectors"
                ],
                options: [
                    { label: "Corroded horn button — cleaned", next: "fix_simple" },
                    { label: "Loose connection at horn", next: "hr_fix_wire" },
                    { label: "Bad ground — intermittent", next: "fix_ground" },
                    { label: "Corroded inline connector", next: "fix_connector" },
                    { label: "Horn button failing", next: "hr_fix_button" }
                ]
            },

            hr_stuck_on: {
                id: "hr_stuck_on",
                type: "instruction",
                text: "Horn sounds continuously and won't stop.",
                checklist: [
                    "Check the horn button — is it stuck in the pressed position?",
                    "Disconnect the horn wire to stop the noise while troubleshooting",
                    "If the horn circuit goes through a relay, the relay may be stuck closed",
                    "Check for a short in the wiring between the button and horn — bare wire touching ground",
                    "Water in the button can cause it to short internally"
                ],
                options: [
                    { label: "Button stuck — freed it", next: "fix_simple" },
                    { label: "Button shorted internally — water damage", next: "hr_fix_button" },
                    { label: "Relay stuck closed", next: "hr_fix_relay" },
                    { label: "Wire shorted to ground", next: "fix_wiring" }
                ]
            },

            // HORN RESOLUTIONS
            hr_fix_fuse: { id: "hr_fix_fuse", type: "resolution", severity: "LOW", title: "Horn Fuse", text: "Horn fuse blown.", action: "Replace with same amperage. If it blows again, check for a short in the horn wiring or a seized horn motor drawing too much current.", partsNeeded: ["Replacement fuse"], estimatedTime: "5 minutes" },

            hr_fix_horn: { id: "hr_fix_horn", type: "resolution", severity: "MEDIUM", title: "Horn Replacement", text: "Horn unit has failed.", action: "Replace the horn. Use a marine-rated horn (stainless or plastic housing). Mount securely with the opening facing down so water drains out. Connect power and ground. Test.", help: "Compact electric horns are inexpensive and easy to replace. Hidden horns (under console) last longer than exposed ones.", partsNeeded: ["Marine-rated electric horn", "Mounting hardware", "Wire connectors"], estimatedTime: "20-45 minutes" },

            hr_fix_button: { id: "hr_fix_button", type: "resolution", severity: "LOW", title: "Horn Button Replacement", text: "Horn button has failed or is corroded.", action: "Replace the horn button. Clean the mounting area. Use a marine-rated button if exposed to weather. Apply dielectric grease to connections.", partsNeeded: ["Horn button (match style — flush mount, push button, etc.)", "Dielectric grease"], estimatedTime: "20-45 minutes" },

            hr_fix_wire: { id: "hr_fix_wire", type: "resolution", severity: "MEDIUM", title: "Horn Wiring Repair", text: "Wiring between the button and horn is damaged.", action: "Run new tinned marine wire. Typically 16 AWG is adequate for most horns. Use heat-shrink connectors. Route away from heat and chafe points.", partsNeeded: ["Tinned marine wire (16 AWG)", "Heat-shrink connectors"], estimatedTime: "30-60 minutes" },

            hr_fix_relay: { id: "hr_fix_relay", type: "resolution", severity: "LOW", title: "Horn Relay", text: "Horn relay has failed.", action: "Replace the relay with same type and rating. Check relay socket for corroded or melted pins.", partsNeeded: ["Horn relay"], estimatedTime: "15-30 minutes" }
        }
    },

    // =============================================
    // TREE 10: BILGE PUMP
    // =============================================
    bilge_pump: {
        title: "Bilge Pump",
        requiredTools: [
            "DMM",
            "12V Test Light",
            "Bucket of water (for float test)",
            "Jumper wires"
        ],
        startNode: "bp_start",
        nodes: {

            bp_start: {
                id: "bp_start",
                type: "question",
                text: "What is the bilge pump problem?",
                warning: "A non-working bilge pump can sink the boat. Treat this as safety-critical before the customer launches.",
                options: [
                    { label: "Pump does not run in MANUAL or AUTO", next: "bp_dead" },
                    { label: "Runs in MANUAL but not AUTO (float switch)", next: "bp_auto_fail" },
                    { label: "Runs in AUTO but not MANUAL", next: "bp_manual_fail" },
                    { label: "Runs continuously — won't shut off", next: "bp_runs_always" },
                    { label: "Runs but does not pump water / pumps slowly", next: "bp_no_flow" },
                    { label: "Cycles on/off rapidly", next: "bp_short_cycle" }
                ]
            },

            bp_dead: {
                id: "bp_dead",
                type: "instruction",
                text: "Check voltage at the pump with the switch in MANUAL.",
                help: "Disconnect the pump connector. With the panel switch in MANUAL, probe the BROWN (+) and BLACK (-) pump wires. Brown is the standard ABYC color for bilge pump power.",
                measurement: { label: "Voltage at pump in MANUAL", unit: "VDC", expectedRange: "12.0 – 13.5" },
                options: [
                    { label: "0V — no power reaching pump", next: "bp_no_power" },
                    { label: "Low (under 10V)", next: "bp_voltage_drop" },
                    { label: "12V+ present but pump does not run", next: "bp_pump_failed" }
                ]
            },

            bp_no_power: {
                id: "bp_no_power",
                type: "instruction",
                text: "Check the bilge pump fuse at the helm panel or fuse block.",
                help: "Bilge pumps are typically on a dedicated fuse (3A–10A depending on pump GPH). Pull the fuse and test continuity.",
                options: [
                    { label: "Fuse blown", next: "bp_fix_fuse" },
                    { label: "Fuse good — check helm switch", next: "bp_check_switch" }
                ]
            },

            bp_check_switch: {
                id: "bp_check_switch",
                type: "instruction",
                text: "Test the 3-position panel switch (OFF / AUTO / MANUAL).",
                help: "With power on, probe the output side of the switch in each position. MANUAL should feed the pump directly. AUTO should only energize when the float closes. OFF should be dead.",
                options: [
                    { label: "Switch has no output in MANUAL", next: "bp_fix_switch" },
                    { label: "Switch outputs 12V — wiring problem downstream", next: "fix_wiring" }
                ]
            },

            bp_voltage_drop: {
                id: "bp_voltage_drop",
                type: "resolution",
                severity: "MEDIUM",
                title: "Voltage Drop on Pump Circuit",
                text: "Pump sees less than 10V — will not generate rated flow and will overheat.",
                action: "Inspect the full pump circuit: fuse block, switch, connectors, and GROUND. Corroded crimp connectors in the bilge are the #1 cause. Replace any green or crusty terminals with heat-shrink butt splices. Verify ground runs to a clean bus or battery negative — never to a screw in the hull.",
                partsNeeded: ["Heat-shrink butt connectors", "Tinned marine wire (14 or 16 AWG)", "Dielectric grease"],
                estimatedTime: "30-60 minutes"
            },

            bp_pump_failed: {
                id: "bp_pump_failed",
                type: "instruction",
                text: "Direct-test the pump with jumpers from the battery.",
                help: "Pull the pump cartridge. Jumper brown to battery (+) and black to battery (-). A working pump should spin immediately.",
                options: [
                    { label: "Pump runs on direct power", next: "bp_intermittent_wiring" },
                    { label: "Pump does not run — motor seized or burned", next: "bp_fix_pump" },
                    { label: "Pump hums but impeller does not spin", next: "bp_fix_impeller" }
                ]
            },

            bp_intermittent_wiring: {
                id: "bp_intermittent_wiring",
                type: "resolution",
                severity: "LOW",
                title: "Bad Pump Connector / Intermittent Wiring",
                text: "Pump is good on the bench but does not run installed.",
                action: "The pump connector is the usual suspect. Cut off the connector, strip back to clean copper, and install heat-shrink butt splices. Ensure the splice sits ABOVE the normal waterline or is fully waterproofed.",
                partsNeeded: ["Heat-shrink butt connectors", "Dielectric grease"],
                estimatedTime: "20-40 minutes"
            },

            bp_auto_fail: {
                id: "bp_auto_fail",
                type: "instruction",
                text: "Test the float switch.",
                help: "Lift the float by hand (or pour a bucket of water in the bilge). With the panel switch in AUTO, the pump should energize when the float rises.",
                options: [
                    { label: "Pump runs when float is lifted by hand", next: "bp_float_ok" },
                    { label: "Pump does NOT run when float is lifted", next: "bp_check_float" }
                ]
            },

            bp_float_ok: {
                id: "bp_float_ok",
                type: "resolution",
                severity: "LOW",
                title: "Float Switch Fouled or Obstructed",
                text: "Float is mechanically blocked by debris, hoses, or wiring.",
                action: "Clean the bilge. Remove trash, leaves, and hose kinks around the float. Re-mount the float so it has free vertical travel and is NOT in line with the discharge stream. Verify it is mounted at the LOW point of the bilge.",
                estimatedTime: "15-30 minutes"
            },

            bp_check_float: {
                id: "bp_check_float",
                type: "instruction",
                text: "Check continuity through the float switch with it lifted.",
                help: "Disconnect the float wires. Set DMM to continuity. Lift the float — you should hear a click and get continuity. Lower it — continuity should open.",
                options: [
                    { label: "No continuity when lifted — float failed", next: "bp_fix_float" },
                    { label: "Continuity is good — wiring problem to float", next: "fix_wiring" }
                ]
            },

            bp_manual_fail: {
                id: "bp_manual_fail",
                type: "resolution",
                severity: "LOW",
                title: "Helm Switch Failure (MANUAL circuit)",
                text: "Panel switch MANUAL contacts are bad or wire is broken. Pump still works through AUTO / float, so pump itself is fine.",
                action: "Replace the helm 3-position bilge switch. Verify MANUAL wire runs directly to pump (bypasses float). Confirm AUTO wire routes through the float switch.",
                partsNeeded: ["3-position bilge pump switch (OFF / AUTO / ON)"],
                estimatedTime: "20-40 minutes"
            },

            bp_runs_always: {
                id: "bp_runs_always",
                type: "question",
                text: "Does the pump stop if you put the panel switch in OFF?",
                help: "If it stops in OFF, the float switch or the AUTO wire is stuck ON. If it keeps running in OFF, the MANUAL circuit is shorted to 12V.",
                options: [
                    { label: "Stops in OFF — AUTO side stuck", next: "bp_float_stuck" },
                    { label: "Keeps running in OFF — MANUAL shorted to 12V", next: "bp_manual_short" }
                ]
            },

            bp_float_stuck: {
                id: "bp_float_stuck",
                type: "resolution",
                severity: "MEDIUM",
                title: "Float Switch Stuck Closed",
                text: "Float is mechanically stuck up or internally welded closed.",
                action: "Inspect float for debris, hose pressure, or oil film that traps it. If the float is clean but continuity stays closed with it down, replace the float switch. Electronic float switches (no moving parts) are a good upgrade.",
                partsNeeded: ["Marine float switch (or electronic solid-state float)"],
                estimatedTime: "30-60 minutes"
            },

            bp_manual_short: {
                id: "bp_manual_short",
                type: "resolution",
                severity: "HIGH",
                title: "MANUAL Wire Shorted to Power",
                text: "The MANUAL feed is hot even with the helm switch OFF. Pump will run until the battery dies.",
                action: "Trace the MANUAL wire from the helm switch to the pump. Look for chafe points where the wire passes through bulkheads or contacts other 12V wires. Repair with heat-shrink and protect with split loom.",
                partsNeeded: ["Tinned marine wire", "Heat-shrink connectors", "Split loom"],
                estimatedTime: "30-90 minutes"
            },

            bp_no_flow: {
                id: "bp_no_flow",
                type: "question",
                text: "When the pump runs, do you hear and feel it pumping?",
                help: "A bilge pump moves a lot of water. If the motor spins but no flow, something is blocking the discharge path or the impeller is gone.",
                options: [
                    { label: "Hear motor running but no water out — impeller stripped", next: "bp_fix_impeller" },
                    { label: "Water dribbles out — hose kinked or clogged", next: "bp_fix_hose" },
                    { label: "Water exits but then drains back in", next: "bp_check_check" }
                ]
            },

            bp_check_check: {
                id: "bp_check_check",
                type: "resolution",
                severity: "LOW",
                title: "Missing or Failed Anti-Siphon / Check Valve",
                text: "Water siphons back through the discharge after the pump cycles off.",
                action: "Confirm the discharge hose has either (a) a high loop 6-12\" ABOVE the waterline or (b) an anti-siphon vented loop. Do NOT install a simple check valve — they are known to stick closed and prevent pumping. Re-route hose with a proper high loop.",
                partsNeeded: ["Anti-siphon vented loop (if needed)", "Bilge hose", "Hose clamps"],
                estimatedTime: "45-90 minutes"
            },

            bp_short_cycle: {
                id: "bp_short_cycle",
                type: "resolution",
                severity: "LOW",
                title: "Pump Short-Cycling",
                text: "Pump cycles every few seconds — float set too close to pump pickup, or water draining back.",
                action: "Raise the float switch so it sits higher above the pump. Add a high-loop or vented loop on the discharge. If using an electronic float, increase the on/off differential setting. Check for minor leak (shaft seal, rainwater) that is constantly re-filling the bilge.",
                estimatedTime: "30-60 minutes"
            },

            // BILGE RESOLUTIONS
            bp_fix_fuse: { id: "bp_fix_fuse", type: "resolution", severity: "LOW", title: "Blown Bilge Fuse", text: "Bilge pump fuse has blown.", action: "Replace with same amperage rating. If it blows again immediately, the pump is seized or wiring is shorted to ground — find the short before installing a new fuse.", partsNeeded: ["Replacement fuse (match rating)"], estimatedTime: "10 minutes" },

            bp_fix_switch: { id: "bp_fix_switch", type: "resolution", severity: "LOW", title: "Helm Bilge Switch", text: "3-position bilge switch has failed.", action: "Replace the OFF/AUTO/ON panel switch. Label wires before removing: B+ (feed), MANUAL (to pump), AUTO (to float). Use tinned marine switch.", partsNeeded: ["3-position bilge pump switch"], estimatedTime: "20-40 minutes" },

            bp_fix_pump: { id: "bp_fix_pump", type: "resolution", severity: "MEDIUM", title: "Pump Motor Failure", text: "Pump motor has failed — seized, burned, or shorted.", action: "Replace the pump cartridge. Most brands (Rule, Attwood, Johnson) use a base that stays mounted — you just swap the motor cartridge. Match GPH rating. Test before re-installing.", partsNeeded: ["Replacement bilge pump cartridge (match GPH)"], estimatedTime: "30-60 minutes" },

            bp_fix_impeller: { id: "bp_fix_impeller", type: "resolution", severity: "LOW", title: "Stripped Impeller", text: "Impeller splines stripped or impeller shaft broken. Motor spins but no flow.", action: "Replace the pump cartridge — impellers are not typically serviced separately on centrifugal bilge pumps.", partsNeeded: ["Replacement bilge pump cartridge"], estimatedTime: "30-60 minutes" },

            bp_fix_float: { id: "bp_fix_float", type: "resolution", severity: "LOW", title: "Float Switch Replacement", text: "Float switch has failed.", action: "Replace the float switch. Mount it so it has free vertical travel and is at the LOW point of the bilge. Keep wire splices ABOVE waterline, heat-shrink only. Consider an electronic solid-state float for longer service life.", partsNeeded: ["Marine float switch (or electronic)"], estimatedTime: "30-60 minutes" },

            bp_fix_hose: { id: "bp_fix_hose", type: "resolution", severity: "LOW", title: "Kinked or Clogged Discharge Hose", text: "Discharge hose is kinked, clogged, or too long a run.", action: "Straighten the hose. Remove debris (leaves, fish scales, sludge). Verify through-hull is clear. Use reinforced bilge hose to prevent collapse. Minimize run length.", partsNeeded: ["Bilge discharge hose", "Hose clamps"], estimatedTime: "30-60 minutes" },

            fix_wiring: { id: "fix_wiring", type: "resolution", severity: "MEDIUM", title: "Wiring Repair", text: "Damaged or corroded wiring found between the switch and the pump.", action: "Repair with tinned marine wire and adhesive heat-shrink butt connectors. Solder + heat shrink is best. Keep all splices above the waterline.", warning: "NEVER use household wire, wire nuts, or electrical tape on a boat. Fire hazard.", partsNeeded: ["Tinned marine wire", "Adhesive heat-shrink butt connectors", "Heat gun", "Dielectric grease"], estimatedTime: "30 min – 2 hours" }
        }
    },

    // =============================================
    // TREE 11: LIVEWELL PUMP
    // =============================================
    livewell_pump: {
        title: "Livewell Pump",
        requiredTools: [
            "DMM",
            "12V Test Light",
            "Jumper wires",
            "Small brush / pick for intake screen"
        ],
        startNode: "lw_start",
        nodes: {

            lw_start: {
                id: "lw_start",
                type: "question",
                text: "What is the livewell problem?",
                options: [
                    { label: "Pump does not run at all", next: "lw_dead" },
                    { label: "Pump runs but no water flow", next: "lw_no_flow" },
                    { label: "Pump runs weak / low flow", next: "lw_low_flow" },
                    { label: "Livewell does not hold water (drains out)", next: "lw_wont_hold" },
                    { label: "Livewell overflows / won't stop filling", next: "lw_overflow" },
                    { label: "Aerator / recirc does not work", next: "lw_aerator" }
                ]
            },

            lw_dead: {
                id: "lw_dead",
                type: "instruction",
                text: "Check voltage at the livewell pump with the switch ON.",
                help: "Livewell pumps are typically on a dedicated switch. Probe the pump feed wires with the switch ON.",
                measurement: { label: "Voltage at pump", unit: "VDC", expectedRange: "12.0 – 13.5" },
                options: [
                    { label: "0V", next: "lw_no_power" },
                    { label: "Low (under 10V)", next: "lw_voltage_drop" },
                    { label: "12V+ but pump does not run", next: "lw_pump_test" }
                ]
            },

            lw_no_power: {
                id: "lw_no_power",
                type: "instruction",
                text: "Check the livewell fuse and switch.",
                options: [
                    { label: "Fuse blown", next: "lw_fix_fuse" },
                    { label: "Fuse good — test helm switch", next: "lw_check_switch" }
                ]
            },

            lw_check_switch: {
                id: "lw_check_switch",
                type: "instruction",
                text: "Probe the output of the livewell switch with it ON.",
                options: [
                    { label: "No output — switch failed", next: "lw_fix_switch" },
                    { label: "12V output — wiring problem downstream", next: "fix_wiring" }
                ]
            },

            lw_voltage_drop: {
                id: "lw_voltage_drop",
                type: "resolution",
                severity: "MEDIUM",
                title: "Voltage Drop on Livewell Circuit",
                text: "Corroded connectors or undersized wire.",
                action: "Inspect all connectors from fuse block through switch to pump. Replace crusty crimps with heat-shrink butt connectors. Verify wire gauge is 14 AWG minimum for typical 500-800 GPH livewell pumps. Check the ground — livewell pumps often share a ground bus that corrodes.",
                partsNeeded: ["Tinned marine wire (14 AWG)", "Heat-shrink butt connectors"],
                estimatedTime: "30-60 minutes"
            },

            lw_pump_test: {
                id: "lw_pump_test",
                type: "instruction",
                text: "Direct-jumper the pump from the battery.",
                help: "Most livewell pumps use a cartridge motor that lifts off a threaded base. Test on the bench.",
                options: [
                    { label: "Pump runs direct — bad connector", next: "lw_intermittent" },
                    { label: "Pump does not run — motor failed", next: "lw_fix_pump" }
                ]
            },

            lw_intermittent: {
                id: "lw_intermittent",
                type: "resolution",
                severity: "LOW",
                title: "Bad Pump Connector",
                text: "Pump works on the bench but not installed.",
                action: "Re-terminate the pump connector. Cut back to clean copper, use heat-shrink butt splices, apply dielectric grease. Mount the splice above waterline.",
                partsNeeded: ["Heat-shrink butt connectors", "Dielectric grease"],
                estimatedTime: "20-40 minutes"
            },

            lw_no_flow: {
                id: "lw_no_flow",
                type: "question",
                text: "Is the boat IN the water or on the trailer?",
                help: "Livewell pumps are NOT self-priming. They must be below the waterline or submerged to pump.",
                options: [
                    { label: "On trailer — not submerged", next: "lw_not_primed" },
                    { label: "In water — submerged", next: "lw_check_intake" }
                ]
            },

            lw_not_primed: {
                id: "lw_not_primed",
                type: "resolution",
                severity: "LOW",
                title: "Pump Is Not Self-Priming",
                text: "Livewell pumps must be BELOW the waterline with free water access. They cannot suck water up to them.",
                action: "Test the boat in the water, not on the trailer. If the pump is above the waterline at rest, that is a design/install problem — the pump must be re-located to the lowest point of the livewell system or a self-priming pump (impeller-type) must be used.",
                estimatedTime: "10 minutes (explain to customer) or 2+ hours to re-plumb"
            },

            lw_check_intake: {
                id: "lw_check_intake",
                type: "instruction",
                text: "Inspect the intake thru-hull / strainer screen.",
                help: "Livewell intake scoops clog with weeds, baitfish, algae, and mud. This is by far the most common complaint.",
                options: [
                    { label: "Intake clogged — cleaned it", next: "lw_fix_intake" },
                    { label: "Intake clear — check hose and impeller", next: "lw_check_hose" }
                ]
            },

            lw_check_hose: {
                id: "lw_check_hose",
                type: "instruction",
                text: "Check the intake hose for kinks, collapse, or air leaks, and check pump impeller.",
                help: "A soft non-reinforced hose can collapse under suction. Air leaks on the suction side cause the pump to draw air instead of water.",
                options: [
                    { label: "Hose collapsed or kinked", next: "lw_fix_hose" },
                    { label: "Hose OK — pump impeller worn", next: "lw_fix_pump" }
                ]
            },

            lw_low_flow: {
                id: "lw_low_flow",
                type: "instruction",
                text: "Common causes of low flow: clogged intake screen, worn impeller, voltage drop, or partially closed valve.",
                options: [
                    { label: "Intake screen partially blocked", next: "lw_fix_intake" },
                    { label: "Impeller worn", next: "lw_fix_pump" },
                    { label: "Voltage at pump under 12V", next: "lw_voltage_drop" },
                    { label: "Diverter or fill/drain valve partially closed", next: "lw_fix_valve" }
                ]
            },

            lw_wont_hold: {
                id: "lw_wont_hold",
                type: "question",
                text: "Where is the water going?",
                options: [
                    { label: "Drains out the overflow standpipe", next: "lw_standpipe" },
                    { label: "Drains back out the pump intake", next: "lw_backflow" },
                    { label: "Leaks into the bilge (cracked tank or hose)", next: "lw_leak" }
                ]
            },

            lw_standpipe: {
                id: "lw_standpipe",
                type: "resolution",
                severity: "LOW",
                title: "Overflow Standpipe Too Short or Missing",
                text: "Livewells use a removable standpipe to set water level. If it is missing or too short, water runs straight to the overflow drain.",
                action: "Install or replace the standpipe. Most livewells take a 1\" or 1-1/4\" ABS or PVC standpipe. Set length to desired water level.",
                partsNeeded: ["Standpipe (match livewell drain size)"],
                estimatedTime: "5-15 minutes"
            },

            lw_backflow: {
                id: "lw_backflow",
                type: "resolution",
                severity: "LOW",
                title: "Water Siphoning Out Through Pump",
                text: "With pump off, water drains back through the pump/intake when boat is in the water.",
                action: "Verify there is an anti-siphon / vented loop on the livewell plumbing if the tank is above the waterline. If the pump housing has lost its flapper / duckbill valve, replace the valve kit.",
                partsNeeded: ["Duckbill / flapper valve kit (if applicable)", "Vented loop (if needed)"],
                estimatedTime: "30-90 minutes"
            },

            lw_leak: {
                id: "lw_leak",
                type: "resolution",
                severity: "MEDIUM",
                title: "Livewell Leak",
                text: "Tank or plumbing is leaking into the bilge.",
                action: "Fill the livewell and inspect under it. Common leaks: drain fitting gasket, standpipe base O-ring, cracked tank, split hose. Re-seal fittings with marine sealant. Replace split hose with reinforced livewell hose. Cracked tanks can sometimes be repaired with plastic welding; often the fix is tank replacement.",
                partsNeeded: ["Marine sealant (3M 4200 or equivalent)", "Replacement gaskets / O-rings", "Reinforced livewell hose"],
                estimatedTime: "30 minutes - 3 hours depending on root cause"
            },

            lw_overflow: {
                id: "lw_overflow",
                type: "question",
                text: "Does the customer have a timer / auto fill feature?",
                options: [
                    { label: "Yes — timer stuck ON", next: "lw_fix_timer" },
                    { label: "No — manual switch stuck ON", next: "lw_fix_switch" },
                    { label: "Switch is OFF but pump still runs", next: "lw_fix_wiring" }
                ]
            },

            lw_aerator: {
                id: "lw_aerator",
                type: "question",
                text: "Does the aerator / recirc pump run?",
                help: "Many livewells have TWO pumps: a fill/intake pump, and a separate aerator/recirc pump that circulates water inside the tank.",
                options: [
                    { label: "No power to aerator — treat as dead pump", next: "lw_dead" },
                    { label: "Runs but bubbles weak", next: "lw_fix_aerator" }
                ]
            },

            // LIVEWELL RESOLUTIONS
            lw_fix_fuse: { id: "lw_fix_fuse", type: "resolution", severity: "LOW", title: "Blown Livewell Fuse", text: "Fuse has blown.", action: "Replace with same amperage. If it blows again, check for a seized pump or short.", partsNeeded: ["Replacement fuse"], estimatedTime: "10 minutes" },

            lw_fix_switch: { id: "lw_fix_switch", type: "resolution", severity: "LOW", title: "Livewell Switch", text: "Helm livewell switch has failed or is stuck.", action: "Replace the switch. Use marine-rated rocker or toggle. Match circuit (momentary vs. maintained) to original.", partsNeeded: ["Marine rocker/toggle switch"], estimatedTime: "20-40 minutes" },

            lw_fix_pump: { id: "lw_fix_pump", type: "resolution", severity: "MEDIUM", title: "Livewell Pump Replacement", text: "Pump motor or impeller has failed.", action: "Replace the pump cartridge. Match GPH (typically 500, 800, or 1100) to the original. Test on bench before final install.", partsNeeded: ["Livewell pump cartridge (match GPH)"], estimatedTime: "30-60 minutes" },

            lw_fix_intake: { id: "lw_fix_intake", type: "resolution", severity: "LOW", title: "Clean Intake Screen", text: "Intake strainer or thru-hull scoop is clogged.", action: "Clean the intake screen. Remove weeds, mud, baitfish. Back-flush if possible. Reinstall screen — never run without one, as debris will jam the impeller.", estimatedTime: "15-30 minutes" },

            lw_fix_hose: { id: "lw_fix_hose", type: "resolution", severity: "LOW", title: "Livewell Hose Replacement", text: "Hose is kinked, collapsed, or leaking air on suction side.", action: "Replace with reinforced livewell hose. Use double stainless clamps at all connections. Route without kinks or sharp bends.", partsNeeded: ["Reinforced livewell hose", "Stainless hose clamps"], estimatedTime: "30-90 minutes" },

            lw_fix_valve: { id: "lw_fix_valve", type: "resolution", severity: "LOW", title: "Diverter / Ball Valve", text: "Diverter valve is partially closed or stuck.", action: "Work the valve through full travel. If internals are corroded or handle is broken, replace the valve. Use marine-grade bronze or reinforced nylon.", partsNeeded: ["Replacement ball valve / diverter (match size and thread)"], estimatedTime: "30-90 minutes" },

            lw_fix_timer: { id: "lw_fix_timer", type: "resolution", severity: "LOW", title: "Livewell Timer", text: "Auto-fill timer is stuck on.", action: "Replace the timer module. Verify wiring matches the new unit's labels. Some boats use a combined timer/aerator controller — replace as an assembly.", partsNeeded: ["Livewell timer / aerator controller"], estimatedTime: "30-60 minutes" },

            lw_fix_wiring: { id: "lw_fix_wiring", type: "resolution", severity: "MEDIUM", title: "Pump Feed Shorted to 12V", text: "Pump runs with switch OFF — wire shorted to power somewhere in the run.", action: "Trace the pump feed wire for chafe points. Repair with heat-shrink and protect with split loom.", partsNeeded: ["Tinned marine wire", "Heat-shrink connectors", "Split loom"], estimatedTime: "30-90 minutes" },

            lw_fix_aerator: { id: "lw_fix_aerator", type: "resolution", severity: "LOW", title: "Aerator Weak", text: "Aerator runs but output is weak.", action: "Check for a clogged air-injection venturi (the small air line on many aerator heads). Clean or replace. If impeller is worn, replace the aerator cartridge.", partsNeeded: ["Aerator cartridge or venturi head"], estimatedTime: "30-60 minutes" },

            fix_wiring: { id: "fix_wiring", type: "resolution", severity: "MEDIUM", title: "Wiring Repair", text: "Damaged or corroded wiring found between the switch and the pump.", action: "Repair with tinned marine wire and adhesive heat-shrink butt connectors. Solder + heat shrink is best. Keep all splices above the waterline.", warning: "NEVER use household wire, wire nuts, or electrical tape on a boat. Fire hazard.", partsNeeded: ["Tinned marine wire", "Adhesive heat-shrink butt connectors", "Heat gun", "Dielectric grease"], estimatedTime: "30 min – 2 hours" }
        }
    },

    // =============================================
    // TREE 12: WASHDOWN PUMP
    // =============================================
    washdown_pump: {
        title: "Washdown Pump",
        requiredTools: [
            "DMM",
            "12V Test Light",
            "Jumper wires"
        ],
        startNode: "wd_start",
        nodes: {

            wd_start: {
                id: "wd_start",
                type: "question",
                text: "What is the washdown pump problem?",
                help: "Washdown pumps are self-priming diaphragm pumps (typically Shurflo or Jabsco) that draw raw water from a thru-hull and feed a hose/nozzle. They run on a pressure switch — on when pressure drops, off when the nozzle is closed.",
                options: [
                    { label: "Pump does not run at all when nozzle opens", next: "wd_dead" },
                    { label: "Pump runs but no water comes out", next: "wd_no_flow" },
                    { label: "Pump cycles on/off rapidly (chatters)", next: "wd_chatter" },
                    { label: "Pump runs continuously — won't shut off", next: "wd_runs_always" },
                    { label: "Pump runs but output is weak / low pressure", next: "wd_low_pressure" },
                    { label: "Pump is noisy or vibrating", next: "wd_noisy" }
                ]
            },

            wd_dead: {
                id: "wd_dead",
                type: "instruction",
                text: "With the washdown panel switch ON and the nozzle OPEN, check voltage at the pump.",
                measurement: { label: "Voltage at pump", unit: "VDC", expectedRange: "12.0 – 13.5" },
                options: [
                    { label: "0V", next: "wd_no_power" },
                    { label: "Low (under 10V)", next: "wd_voltage_drop" },
                    { label: "12V+ but pump does not run", next: "wd_pump_test" }
                ]
            },

            wd_no_power: {
                id: "wd_no_power",
                type: "question",
                text: "Most washdown pumps only have power when (a) panel switch is ON, (b) pressure switch senses pressure drop. What do you see?",
                options: [
                    { label: "Fuse blown", next: "wd_fix_fuse" },
                    { label: "Panel switch has no output", next: "wd_fix_switch" },
                    { label: "Panel switch outputs 12V but pump still dead — pressure switch", next: "wd_pressure_switch" }
                ]
            },

            wd_pressure_switch: {
                id: "wd_pressure_switch",
                type: "instruction",
                text: "Test the integrated pressure switch on the pump head.",
                help: "Most Shurflo/Jabsco washdown pumps have an internal pressure switch. With the panel switch ON and nozzle OPEN, there should be 12V on both sides of the pressure switch. With nozzle CLOSED, system pressure rises and the switch opens, cutting power to the motor.",
                options: [
                    { label: "No continuity across pressure switch with nozzle open — switch failed", next: "wd_fix_pressure_switch" },
                    { label: "Continuity good — internal motor wiring failed", next: "wd_fix_pump" }
                ]
            },

            wd_voltage_drop: {
                id: "wd_voltage_drop",
                type: "resolution",
                severity: "MEDIUM",
                title: "Voltage Drop",
                text: "Washdown pump motors draw 6-10A. Voltage drop under load prevents them from starting.",
                action: "Upsize the wiring if original is under 14 AWG. Clean all crimp connections — replace with heat-shrink butt splices. Verify ground runs to a clean point. Check panel switch and any inline fuse holder for heat damage.",
                partsNeeded: ["Tinned marine wire (12 or 14 AWG)", "Heat-shrink butt connectors", "Fuse holder (if heat damaged)"],
                estimatedTime: "45-90 minutes"
            },

            wd_pump_test: {
                id: "wd_pump_test",
                type: "instruction",
                text: "Direct-jumper the pump motor leads from the battery (bypass the pressure switch).",
                help: "On Shurflo pumps, you can often probe motor leads at the pressure-switch head.",
                options: [
                    { label: "Motor runs on direct power", next: "wd_fix_pressure_switch" },
                    { label: "Motor does not run — motor seized or brushes worn", next: "wd_fix_pump" }
                ]
            },

            wd_no_flow: {
                id: "wd_no_flow",
                type: "question",
                text: "When the pump runs, do you hear a healthy chugging sound or does it spin freely with no resistance?",
                help: "A diaphragm pump under load sounds like a quick 'chug-chug-chug'. If it spins freely with no resistance, it is not moving water.",
                options: [
                    { label: "Spins freely — pump losing prime / sucking air", next: "wd_prime" },
                    { label: "Chugs normally — blockage downstream", next: "wd_check_nozzle" }
                ]
            },

            wd_prime: {
                id: "wd_prime",
                type: "question",
                text: "Check the SUCTION side (intake). Common issues:",
                options: [
                    { label: "Intake strainer clogged", next: "wd_fix_strainer" },
                    { label: "Suction hose cracked or loose clamp — air leak", next: "wd_fix_suction" },
                    { label: "Thru-hull seacock closed or clogged", next: "wd_fix_seacock" },
                    { label: "Pump head diaphragm torn — replace head kit", next: "wd_fix_head" }
                ]
            },

            wd_check_nozzle: {
                id: "wd_check_nozzle",
                type: "question",
                text: "Pump is pumping — check the discharge side.",
                options: [
                    { label: "Nozzle clogged", next: "wd_fix_nozzle" },
                    { label: "Hose kinked or crimped", next: "wd_fix_hose" },
                    { label: "Inline filter after pump is clogged", next: "wd_fix_filter" }
                ]
            },

            wd_chatter: {
                id: "wd_chatter",
                type: "instruction",
                text: "Short-cycling / chattering means system pressure is not holding steady. Causes:",
                options: [
                    { label: "Small leak in pressure side (drip at nozzle or fitting)", next: "wd_fix_leak" },
                    { label: "Pressure switch differential too tight / failing", next: "wd_fix_pressure_switch" },
                    { label: "Missing accumulator — consider adding one", next: "wd_fix_accumulator" }
                ]
            },

            wd_runs_always: {
                id: "wd_runs_always",
                type: "question",
                text: "Does the pump stop when you turn the PANEL switch off?",
                options: [
                    { label: "Yes — system never builds pressure", next: "wd_no_pressure" },
                    { label: "No — pump wire shorted to 12V", next: "wd_fix_short" }
                ]
            },

            wd_no_pressure: {
                id: "wd_no_pressure",
                type: "question",
                text: "Pump runs but never builds pressure to trip the pressure switch off. Check:",
                options: [
                    { label: "Small leak somewhere on discharge side", next: "wd_fix_leak" },
                    { label: "Diaphragm or internal valve failed — rebuild head", next: "wd_fix_head" },
                    { label: "Pressure switch set too high / failed", next: "wd_fix_pressure_switch" }
                ]
            },

            wd_low_pressure: {
                id: "wd_low_pressure",
                type: "instruction",
                text: "Pump runs but the spray is weak. Most common: worn pump head, clogged strainer, or voltage drop.",
                options: [
                    { label: "Intake strainer partially blocked", next: "wd_fix_strainer" },
                    { label: "Diaphragm or valves worn — rebuild head", next: "wd_fix_head" },
                    { label: "Voltage under 12V at pump", next: "wd_voltage_drop" },
                    { label: "Nozzle clogged or wrong pattern", next: "wd_fix_nozzle" }
                ]
            },

            wd_noisy: {
                id: "wd_noisy",
                type: "resolution",
                severity: "LOW",
                title: "Pump Vibration / Noise",
                text: "Diaphragm pumps transmit vibration to the hull.",
                action: "Confirm the pump is mounted on its rubber feet / isolators (never bolt direct to hull). Install short sections of flexible hose on BOTH inlet and outlet (no rigid pipe direct to pump ports). If the pump is old and noise is new, internal bearings or diaphragm may be worn — rebuild or replace.",
                partsNeeded: ["Rubber mounting feet", "Short sections of flexible hose", "Hose clamps"],
                estimatedTime: "30-60 minutes"
            },

            // WASHDOWN RESOLUTIONS
            wd_fix_fuse: { id: "wd_fix_fuse", type: "resolution", severity: "LOW", title: "Blown Washdown Fuse", text: "Fuse blown.", action: "Replace with same amperage. If it blows again immediately, pump is seized or wiring is shorted.", partsNeeded: ["Replacement fuse"], estimatedTime: "10 minutes" },

            wd_fix_switch: { id: "wd_fix_switch", type: "resolution", severity: "LOW", title: "Washdown Switch", text: "Panel switch failed.", action: "Replace with marine-rated rocker or toggle switch. Match original amp rating.", partsNeeded: ["Marine rocker/toggle switch"], estimatedTime: "20-40 minutes" },

            wd_fix_pressure_switch: { id: "wd_fix_pressure_switch", type: "resolution", severity: "LOW", title: "Pressure Switch Replacement", text: "Internal pressure switch on pump head has failed.", action: "Most Shurflo/Jabsco pumps have a replaceable pressure switch on top of the pump head — two screws and two wires. Match part number to pump model. Set pressure to factory spec (typically 40-60 PSI for washdown).", partsNeeded: ["Pressure switch (match pump model)"], estimatedTime: "20-40 minutes" },

            wd_fix_pump: { id: "wd_fix_pump", type: "resolution", severity: "MEDIUM", title: "Pump Motor Replacement", text: "Pump motor has failed — seized, brushes worn, or internal short.", action: "On a well-used pump, the motor is usually not economical to rebuild — replace the complete pump. Match GPM and pressure spec. Verify mount pattern matches original or adapt plumbing.", partsNeeded: ["Washdown pump (match GPM and pressure)"], estimatedTime: "60-120 minutes" },

            wd_fix_head: { id: "wd_fix_head", type: "resolution", severity: "MEDIUM", title: "Pump Head Rebuild", text: "Diaphragm, valves, or head internals are worn.", action: "Install a pump head rebuild kit. Kit typically includes diaphragm, check valves, and gaskets. Torque head screws evenly in a cross pattern — over-tightening distorts the diaphragm.", partsNeeded: ["Pump head rebuild kit (match pump model)"], estimatedTime: "45-90 minutes" },

            wd_fix_strainer: { id: "wd_fix_strainer", type: "resolution", severity: "LOW", title: "Clean Intake Strainer", text: "Intake strainer is clogged.", action: "Remove, clean, and reinstall the strainer. Back-flush with fresh water. Replace if the screen is damaged. Never run the pump without a strainer — debris will destroy the diaphragm valves.", partsNeeded: ["Replacement strainer cartridge (if damaged)"], estimatedTime: "15-30 minutes" },

            wd_fix_suction: { id: "wd_fix_suction", type: "resolution", severity: "LOW", title: "Suction-Side Air Leak", text: "Suction hose is cracked or a clamp is loose. Pump sucks air and cannot prime.", action: "Replace suction hose with reinforced marine hose. Double-clamp all connections on the suction side with stainless clamps.", partsNeeded: ["Reinforced marine hose (match pump inlet)", "Stainless hose clamps"], estimatedTime: "30-60 minutes" },

            wd_fix_seacock: { id: "wd_fix_seacock", type: "resolution", severity: "LOW", title: "Seacock / Thru-Hull Blocked", text: "Raw water intake is closed or fouled.", action: "Open seacock. Back-flush the thru-hull with fresh water or clear with a bent wire. If the seacock is seized, service or replace it. Install an intake strainer before the pump if there is not one already.", partsNeeded: ["Intake strainer (if missing)", "Seacock service kit (if needed)"], estimatedTime: "30-90 minutes" },

            wd_fix_nozzle: { id: "wd_fix_nozzle", type: "resolution", severity: "LOW", title: "Clogged Nozzle", text: "Washdown nozzle orifice is clogged with sand or salt.", action: "Remove, disassemble, soak in vinegar or descaler, flush. Replace if corroded internally.", partsNeeded: ["Replacement washdown nozzle (if needed)"], estimatedTime: "15-30 minutes" },

            wd_fix_hose: { id: "wd_fix_hose", type: "resolution", severity: "LOW", title: "Kinked Discharge Hose", text: "Discharge hose is kinked or crushed.", action: "Re-route hose without sharp bends. Replace kinked section with reinforced marine hose.", partsNeeded: ["Reinforced marine hose", "Hose clamps"], estimatedTime: "30-60 minutes" },

            wd_fix_filter: { id: "wd_fix_filter", type: "resolution", severity: "LOW", title: "Clogged Inline Filter", text: "Inline filter between pump and nozzle is clogged.", action: "Remove and clean the filter element. Replace if damaged. Schedule cleaning at every service interval in salt use.", partsNeeded: ["Replacement filter element (if damaged)"], estimatedTime: "15-30 minutes" },

            wd_fix_leak: { id: "wd_fix_leak", type: "resolution", severity: "LOW", title: "Pressure-Side Leak", text: "Small leak on the discharge side prevents pressure from holding — pump short-cycles.", action: "Inspect every fitting from pump outlet to nozzle. Check quick-connect O-rings, hose clamp seals, and nozzle trigger. Replace O-rings or fittings as needed.", partsNeeded: ["Replacement O-rings", "Thread sealant (non-hardening)", "Replacement fittings as needed"], estimatedTime: "30-60 minutes" },

            wd_fix_accumulator: { id: "wd_fix_accumulator", type: "resolution", severity: "LOW", title: "Install Accumulator Tank", text: "Small accumulator tank smooths pressure and stops short-cycling on a tight system.", action: "Install a small (0.5L–1L) accumulator tank on the pressure side near the pump. Pre-charge to ~20 PSI. This eliminates chattering and extends pump life.", partsNeeded: ["Small accumulator tank", "Tee fitting", "Hose / clamps"], estimatedTime: "45-90 minutes" },

            wd_fix_short: { id: "wd_fix_short", type: "resolution", severity: "HIGH", title: "Pump Feed Shorted to 12V", text: "Pump runs with panel switch OFF — wire shorted to power.", action: "Trace the pump feed wire for chafe points. Repair with heat-shrink and protect with split loom.", partsNeeded: ["Tinned marine wire", "Heat-shrink connectors", "Split loom"], estimatedTime: "30-90 minutes" }
        }
    },

    // =============================================
    // TREE: YAMAHA FLASH-CODE DIAGNOSTIC
    // Walks a tech through reading and acting on
    // Yamaha self-diagnosis flash codes on F115C,
    // F150TR, F200TR and related platforms. Based
    // on factory service manuals (Yamaha 68V, 63P,
    // and 69J series).
    // =============================================
    yamaha_flash_codes: {
        title: "Yamaha Flash-Code Diagnostic (F115 / F150 / F200)",
        requiredTools: [
            "Yamaha Diagnostic Test Lead YB-06795 (or Yamaha YDS scan tool)",
            "Digital Multimeter (DMM)",
            "Peak voltage adapter for DMM",
            "Service manual for your specific model / HIN"
        ],
        startNode: "start",
        nodes: {

            start: {
                id: "start",
                type: "instruction",
                text: "Confirm all electrical connectors are seated, battery is fully charged, and lanyard is in RUN.",
                help: "The self-diagnosis only reads accurately if wiring is intact and battery voltage is healthy. Low voltage alone will trigger code 19 and mask other faults.",
                checklist: [
                    "Battery at rest: 12.4–12.8 V (load-test if marginal)",
                    "Lanyard clip installed in RUN position at helm",
                    "No loose ECM, sensor, or ignition coil connectors",
                    "No water in the diagnostic connector under the cowling",
                    "Correct fuses installed (F115: 20A and 30A)"
                ],
                options: [
                    { label: "Everything confirmed — ready to read codes", next: "connect_tool" },
                    { label: "Battery weak — charge or replace first", next: "fix_battery" },
                    { label: "Lanyard was off — re-attach and recheck", next: "fix_lanyard" }
                ]
            },

            connect_tool: {
                id: "connect_tool",
                type: "instruction",
                text: "Connect the Yamaha diagnostic test lead YB-06795 (or YDS) to the 3-pin diagnostic connector under the cowling, then idle the engine.",
                help: "The flash indicator blinks a 2-digit code: long pulses = tens, short pulses = ones. Example: code 23 is 2 long + 3 short.",
                checklist: [
                    "Remove the 3-pin diagnostic connector cap",
                    "Plug in the test lead / YDS",
                    "Start the engine and let it idle (codes only flash with the engine running)",
                    "Watch the indicator for at least 30 seconds",
                    "If multiple faults exist, Yamaha flashes the lowest-numbered code first — fix that, then re-check"
                ],
                options: [
                    { label: "Single flash every ~5 seconds — Code 1 (normal)", next: "code_1" },
                    { label: "Code 13 — pulser coil", next: "code_13" },
                    { label: "Code 15 — engine temp sensor", next: "code_15" },
                    { label: "Code 18 — throttle position sensor", next: "code_18" },
                    { label: "Code 19 — battery voltage", next: "code_19" },
                    { label: "Code 23 — intake air temp sensor", next: "code_23" },
                    { label: "Code 28 — neutral / shift position switch", next: "code_28" },
                    { label: "Code 29 — intake air pressure sensor", next: "code_29" },
                    { label: "Code 37 — ISC (F150/F200) or intake leak (F115)", next: "code_37" },
                    { label: "Code 39 — oil pressure sensor", next: "code_39" },
                    { label: "Code 44 — stop lanyard switch", next: "code_44" },
                    { label: "Code 45 — shift cut switch", next: "code_45" },
                    { label: "Code 46 — thermoswitch", next: "code_46" },
                    { label: "Code 49 or 59 (F115 only)", next: "code_115_only" },
                    { label: "No flash at all — indicator dark", next: "no_flash" }
                ]
            },

            no_flash: {
                id: "no_flash",
                type: "instruction",
                text: "Diagnostic indicator is not lighting. Check power to the indicator and the connector.",
                checklist: [
                    "Verify the test lead is the correct Yamaha part (YB-06795)",
                    "Check the LED itself by testing on a different engine if available",
                    "Measure 12V at the indicator supply pin with key ON",
                    "Reseat the 3-pin diagnostic connector under the cowling",
                    "Inspect the connector for corrosion"
                ],
                options: [
                    { label: "12V is present but no flash — faulty indicator or ECM output", next: "fix_ecm_check" },
                    { label: "No 12V at indicator — check fuse and main harness", next: "fix_fuse" },
                    { label: "Now flashing — back to reading codes", next: "connect_tool" }
                ]
            },

            code_1: {
                id: "code_1",
                type: "resolution",
                severity: "LOW",
                title: "Code 1 — Normal",
                text: "ECM reports no electrical faults on any monitored sensor.",
                action: "If the engine still has a symptom, the fault is mechanical (compression, cooling, fuel supply, ignition timing) or beyond the ECM's monitored range. Move to the mechanical troubleshooting tree that matches the symptom (no-start, overheat, rough running, etc.).",
                partsNeeded: [],
                estimatedTime: "—"
            },

            code_13: {
                id: "code_13",
                type: "instruction",
                text: "Code 13 — Incorrect pulser coil signal. Measure the pulser coil.",
                help: "The pulser coil triggers ignition. A failing pulser causes hard starts, misfire, or a no-start with spark issues.",
                measurement: { label: "Pulser Coil Resistance (W/R,W/B to B)", unit: "Ω", expectedRange: "F150: 459 – 561" },
                checklist: [
                    "Disconnect the pulser coil connector at the ECM",
                    "Measure resistance end-to-end on each coil lead",
                    "Check peak voltage output (loaded) — F115: 3.0V cranking, 26V @1500 rpm, 44V @3500 rpm; F150: 3.6V cranking, 23.9V @1500, 49.7V @3500",
                    "Verify pulser coil air gap 0.3–0.7 mm if flywheel has been off",
                    "Inspect the pulser coil lead for chafing against the flywheel boss"
                ],
                options: [
                    { label: "Resistance out of spec — replace pulser coil", next: "fix_pulser" },
                    { label: "Resistance OK but peak voltage low — replace pulser coil", next: "fix_pulser" },
                    { label: "Pulser OK — suspect ECM connector or ECM", next: "fix_ecm_check" }
                ]
            },

            code_15: {
                id: "code_15",
                type: "instruction",
                text: "Code 15 — Incorrect engine coolant temperature sensor signal. Resistance test the sensor cold.",
                measurement: { label: "Engine Temp Sensor Resistance", unit: "kΩ", expectedRange: "F115: 2.44 @ 20°C; F150: 54.2–69.0 @ 20°C" },
                checklist: [
                    "Disconnect the sensor and measure resistance at ambient",
                    "Warm the sensor in a water bath and watch resistance drop",
                    "F115: 4.62 kΩ @ 5°C, 2.44 kΩ @ 20°C, 0.19 kΩ @ 100°C",
                    "F150: 54.2–69.0 kΩ @ 20°C, 3.12–3.48 kΩ @ 100°C",
                    "Check the B/Y wire from sensor to ECM for continuity"
                ],
                options: [
                    { label: "Sensor out of spec — replace", next: "fix_sensor" },
                    { label: "Sensor OK — repair damaged wiring or connector", next: "fix_wiring" }
                ]
            },

            code_18: {
                id: "code_18",
                type: "instruction",
                text: "Code 18 — Incorrect TPS signal. Check TPS output voltage.",
                help: "If the TPS has been removed or throttle body serviced, it needs adjustment to the factory idle-voltage spec.",
                measurement: { label: "TPS Output Voltage at idle stop (P wire)", unit: "V", expectedRange: "F115: 0.732 ± 0.014 | F150: 0.70 ± 0.02" },
                checklist: [
                    "Back-probe the TPS P (signal) wire with key ON, engine OFF",
                    "Verify 5V on O (reference) wire",
                    "Sweep throttle slowly — output should rise smoothly to ~4.5V with no dead spots",
                    "If TPS was disassembled, loosen the two mounting screws and rotate TPS to hit spec voltage, then retorque"
                ],
                options: [
                    { label: "Voltage erratic or flat — replace TPS", next: "fix_tps" },
                    { label: "Voltage offset — run TPS adjustment procedure", next: "fix_tps_adjust" },
                    { label: "TPS and wiring OK — suspect ECM", next: "fix_ecm_check" }
                ]
            },

            code_19: {
                id: "code_19",
                type: "instruction",
                text: "Code 19 — Incorrect battery voltage. Measure battery and charging system.",
                measurement: { label: "Charging Voltage at 1500–2000 RPM", unit: "VDC", expectedRange: "13.8 – 14.8" },
                checklist: [
                    "Battery at rest: 12.4–12.8 V",
                    "Running voltage: 13.8–14.8 V at 1500+ RPM",
                    "F115 rectifier/regulator peak output (R–B): 12.5V @1500, 13.0V @3500 min",
                    "Inspect battery cables and main fuse (F115: 20A & 30A)",
                    "Load-test the battery under cranking load"
                ],
                options: [
                    { label: "Battery weak — replace", next: "fix_battery" },
                    { label: "Running voltage low — replace rectifier/regulator", next: "fix_regulator" },
                    { label: "Cables corroded — clean or replace", next: "fix_cables" },
                    { label: "Voltage is fine now — clear code and retest", next: "clear_and_retest" }
                ]
            },

            code_23: {
                id: "code_23",
                type: "instruction",
                text: "Code 23 — Incorrect IAT sensor signal. Resistance test the IAT.",
                measurement: { label: "IAT Resistance @ 20°C", unit: "kΩ", expectedRange: "F150: 2.20 – 2.70" },
                checklist: [
                    "Disconnect IAT and measure resistance at ambient",
                    "Warm with hand or low heat — resistance should drop smoothly",
                    "Check signal wire from sensor to ECM for continuity and shorts",
                    "Inspect connector for corrosion"
                ],
                options: [
                    { label: "Out of spec — replace IAT", next: "fix_sensor" },
                    { label: "In spec — repair wiring/connector", next: "fix_wiring" }
                ]
            },

            code_28: {
                id: "code_28",
                type: "instruction",
                text: "Code 28 — Neutral / shift position switch signal.",
                checklist: [
                    "Confirm shifter is fully in neutral (partial detent triggers this)",
                    "Disconnect the switch and check continuity — must change state between neutral and in-gear",
                    "Inspect the switch actuator for physical damage",
                    "Check wiring from switch to ECM"
                ],
                options: [
                    { label: "Switch contacts stuck — replace", next: "fix_neutral_sw" },
                    { label: "Shift linkage out of adjustment", next: "fix_shift_adjust" },
                    { label: "Wiring damage — repair", next: "fix_wiring" }
                ]
            },

            code_29: {
                id: "code_29",
                type: "instruction",
                text: "Code 29 — Intake air pressure (MAP) sensor out of range.",
                checklist: [
                    "Verify MAP vacuum hose (if external) is connected and clear",
                    "Key ON, engine OFF: MAP reads atmospheric baseline",
                    "Engine running at idle: voltage should track engine vacuum",
                    "Spray carb cleaner around intake gaskets — RPM change indicates vacuum leak",
                    "Compare live MAP data on YDS to TPS position — should correlate"
                ],
                options: [
                    { label: "Large vacuum leak found — fix gasket", next: "fix_intake_gasket" },
                    { label: "MAP doesn't track vacuum — replace", next: "fix_sensor" },
                    { label: "Vacuum hose cracked or off — repair", next: "fix_vacuum_line" }
                ]
            },

            code_37: {
                id: "code_37",
                type: "instruction",
                text: "Code 37 — F115: intake passage air leakage. F150/F200: idle speed control (ISC) signal.",
                checklist: [
                    "F115: spray carb cleaner at intake manifold, throttle body base, TPS — RPM change = vacuum leak. Replace gasket.",
                    "F150/F200: clean ISC valve passages of carbon and varnish",
                    "Verify throttle plate fully closes — check cable adjustment and linkage",
                    "Re-run TPS adjustment so ECM has correct closed-throttle reference",
                    "Clear the code and let idle learn over several minutes"
                ],
                options: [
                    { label: "Found vacuum leak — replace gasket", next: "fix_intake_gasket" },
                    { label: "ISC valve dirty — clean and retest", next: "fix_clean_isc" },
                    { label: "Throttle cable out of adjustment", next: "fix_throttle_adjust" },
                    { label: "ISC valve electrically faulty — replace", next: "fix_isc" }
                ]
            },

            code_39: {
                id: "code_39",
                type: "instruction",
                text: "Code 39 — Oil pressure sensor signal. STOP the engine and check oil level FIRST.",
                help: "This code can mean real low oil pressure. Running on low oil pressure destroys the engine.",
                measurement: { label: "Mechanical Oil Pressure at idle", unit: "PSI", expectedRange: "F115: ~50 @ 55°C | F150: ~65 @ idle | F200: ~94 @ 700rpm" },
                checklist: [
                    "Dipstick check — top up if low and look for dilution with fuel or water",
                    "Remove oil pressure sensor and install a mechanical gauge",
                    "Verify pressure at idle matches factory reference",
                    "If mechanical pressure is low, inspect oil strainer and pump; relief valve opens at 490 kPa (F115)",
                    "If mechanical pressure is normal, sensor is faulty — replace"
                ],
                options: [
                    { label: "Oil was low — top up, clear code, monitor", next: "fix_oil_topup" },
                    { label: "Mechanical pressure low — oil pump / strainer service", next: "fix_oil_pump" },
                    { label: "Mechanical pressure OK — replace sensor", next: "fix_sensor" },
                    { label: "Oil contaminated with fuel/water — find cause first", next: "fix_oil_contam" }
                ]
            },

            code_44: {
                id: "code_44",
                type: "instruction",
                text: "Code 44 — Stop lanyard switch signal active.",
                checklist: [
                    "Verify lanyard clip is installed in RUN position at helm",
                    "Remove and inspect the lanyard switch for water intrusion and corrosion",
                    "Continuity test: open with clip installed, closed with clip off",
                    "Check wiring for shorts to ground"
                ],
                options: [
                    { label: "Lanyard was removed — re-attach", next: "fix_lanyard" },
                    { label: "Switch contacts stuck closed — replace", next: "fix_lanyard_switch" },
                    { label: "Wiring shorted to ground — repair", next: "fix_wiring" }
                ]
            },

            code_45: {
                id: "code_45",
                type: "instruction",
                text: "Code 45 — Shift cut switch signal.",
                checklist: [
                    "Listen for the switch click while shifting through detents",
                    "Continuity test between switch terminals as shifter moves",
                    "Verify the switch actuator geometry is intact",
                    "Check wiring back to the ECM"
                ],
                options: [
                    { label: "Switch sticky / doesn't change state — replace", next: "fix_shift_cut" },
                    { label: "Wiring damaged — repair", next: "fix_wiring" }
                ]
            },

            code_46: {
                id: "code_46",
                type: "instruction",
                text: "Code 46 — Thermoswitch signal. Check for real overheat first.",
                help: "Stop engine if hot. Thermoswitch is a hard-trip overheat sensor — it may be signaling an actual overheat.",
                checklist: [
                    "If engine is hot, STOP and cool before testing",
                    "Tell-tale pencil-width steady stream — if not, service cooling (impeller, intake)",
                    "Remove thermoswitch and test in hot water bath — factory spec often ~84°C / 183°F",
                    "Inspect connector for corrosion",
                    "Verify ECM ground is clean"
                ],
                options: [
                    { label: "Actual overheat — go to overheat tree", next: "overheat_redirect" },
                    { label: "Switch doesn't actuate in hot water — replace", next: "fix_thermoswitch" },
                    { label: "Wiring / connector bad — repair", next: "fix_wiring" }
                ]
            },

            code_115_only: {
                id: "code_115_only",
                type: "instruction",
                text: "F115 informational codes — 49 (cold-start timing correction) and 59 (memory overwrite).",
                checklist: [
                    "Code 49 at cold start is normal — ECM applied a small ignition correction",
                    "Code 49 persisting after warmup → engine temp sensor stuck cold (see code 15 steps)",
                    "Code 59 = ECM memory overwritten abnormally — usually caused by severe voltage dropout during operation",
                    "Inspect battery cables, main power feed to ECM, and load-test the battery"
                ],
                options: [
                    { label: "Code 49 after warmup — treat as code 15", next: "code_15" },
                    { label: "Code 59 — clear and test battery/cables", next: "fix_ecm_power" },
                    { label: "Both cleared and do not return", next: "clear_and_retest" }
                ]
            },

            overheat_redirect: {
                id: "overheat_redirect",
                type: "resolution",
                severity: "HIGH",
                title: "Go to the Engine Overheat tree",
                text: "Thermoswitch is reporting an overheat. That's a mechanical cooling problem — follow the standard overheat tree.",
                action: "Exit this tree and start the 'Engine Overheat' diagnostic. Quick checks: water pump tell-tale flow, raw-water intake clear, thermostat operation (F115 opens 48–52°C / F150/F200 58–62°C), impeller condition.",
                partsNeeded: ["Water pump impeller kit", "Thermostat"],
                estimatedTime: "1-3 hours"
            },

            // ==== YAMAHA FLASH-CODE RESOLUTIONS ====
            fix_pulser: { id: "fix_pulser", type: "resolution", severity: "MEDIUM", title: "Pulser Coil Replacement", text: "Pulser coil out of spec.", action: "Replace pulser coil assembly. Verify air gap 0.3–0.7 mm after installation. Clear code via YDS and verify the engine revs cleanly.", partsNeeded: ["Pulser coil assembly (match part number to serial)"], estimatedTime: "2-4 hours" },

            fix_sensor: { id: "fix_sensor", type: "resolution", severity: "MEDIUM", title: "Replace Sensor", text: "Sensor is out of spec.", action: "Replace the affected sensor with the correct Yamaha part. Apply dielectric grease to the connector. Clear the code and confirm it doesn't return after a warm-up cycle.", partsNeeded: ["Replacement sensor", "Dielectric grease"], estimatedTime: "30-90 minutes" },

            fix_tps: { id: "fix_tps", type: "resolution", severity: "MEDIUM", title: "TPS Replacement", text: "TPS signal is erratic or flat.", action: "Replace the throttle position sensor. Perform the TPS adjustment procedure — loosen the two mounting screws and rotate to hit the factory idle voltage (F115: 0.732V, F150: 0.70V), then retorque. Clear code and verify with YDS live data sweep.", partsNeeded: ["Throttle position sensor", "Dielectric grease"], estimatedTime: "1-2 hours" },

            fix_tps_adjust: { id: "fix_tps_adjust", type: "resolution", severity: "LOW", title: "TPS Adjustment Procedure", text: "TPS signal was offset; rotation adjustment corrected it.", action: "Loosen the TPS mounting screws. Rotate the TPS body while watching signal voltage until it matches the factory idle-stop value. Retorque. Sweep throttle to verify linear rise. Clear code.", partsNeeded: [], estimatedTime: "15-45 minutes" },

            fix_regulator: { id: "fix_regulator", type: "resolution", severity: "MEDIUM", title: "Rectifier / Regulator Replacement", text: "Charging output too low.", action: "Replace the rectifier/regulator. Verify stator/lighting coil output first (F115 lighting coil open-circuit peak: 37V @1500, 89V @3500 rpm) — regulators often die because a failing stator overheated them. Re-test charging voltage after swap.", partsNeeded: ["Rectifier/regulator", "Heat-sink compound"], estimatedTime: "1-2 hours" },

            fix_shift_adjust: { id: "fix_shift_adjust", type: "resolution", severity: "LOW", title: "Shift Linkage Adjustment", text: "Shift linkage out of adjustment; neutral switch saw a partial detent.", action: "Adjust the shift cable per the factory procedure so the shifter detents fully in each position and the switch actuator lines up cleanly. Verify with YDS live data if available.", partsNeeded: [], estimatedTime: "30-60 minutes" },

            fix_intake_gasket: { id: "fix_intake_gasket", type: "resolution", severity: "MEDIUM", title: "Intake Gasket / Leak Repair", text: "Vacuum leak on the intake side.", action: "Replace the intake manifold gasket and/or throttle body gasket. Confirm no cracks at vacuum nipples. Retorque intake per spec. Clear code and run idle-learn.", partsNeeded: ["Intake manifold gasket", "Throttle body gasket"], estimatedTime: "2-4 hours" },

            fix_vacuum_line: { id: "fix_vacuum_line", type: "resolution", severity: "LOW", title: "Vacuum Line Repair", text: "MAP sensor vacuum line cracked or disconnected.", action: "Replace the MAP vacuum hose with correct ID marine-grade vacuum hose. Route away from heat sources. Secure with small clamps if specified.", partsNeeded: ["Vacuum hose", "Small clamps"], estimatedTime: "15-45 minutes" },

            fix_clean_isc: { id: "fix_clean_isc", type: "resolution", severity: "LOW", title: "Clean ISC Valve", text: "Idle speed control valve was carboned up.", action: "Remove the ISC valve and clean passages with throttle-body cleaner and a soft brush. Do NOT use abrasive on the valve seat. Reinstall with a new gasket, reconnect, clear the code, and let idle re-learn.", partsNeeded: ["Throttle-body cleaner", "ISC gasket"], estimatedTime: "1-2 hours" },

            fix_isc: { id: "fix_isc", type: "resolution", severity: "MEDIUM", title: "Replace ISC Valve", text: "Idle speed control valve is electrically or mechanically failed.", action: "Replace the ISC valve with the correct Yamaha part. Install new gasket. Clear code and allow idle to re-learn. Confirm idle RPM matches spec (F115: 750 ± 50, F150: 700 ± 50, F200: 650–750).", partsNeeded: ["ISC valve", "ISC gasket"], estimatedTime: "1-2 hours" },

            fix_throttle_adjust: { id: "fix_throttle_adjust", type: "resolution", severity: "LOW", title: "Throttle Cable / Link Adjustment", text: "Throttle plate wasn't closing fully.", action: "Adjust the throttle cable per the factory 'Adjusting the throttle link and throttle cable' procedure so the plate closes firmly on the idle stop. Then rerun the TPS adjustment. Clear code.", partsNeeded: [], estimatedTime: "30-60 minutes" },

            fix_oil_topup: { id: "fix_oil_topup", type: "resolution", severity: "LOW", title: "Oil Top-Up", text: "Oil level was low.", action: "Top up to the upper dipstick mark with Yamalube 4M 10W-30 (or factory-approved equivalent). Inspect for leaks at the filter, drain plug, and valve cover. Investigate consumption if the engine uses oil between services.", partsNeeded: ["Yamalube 4M 10W-30 engine oil"], estimatedTime: "15-30 minutes" },

            fix_oil_pump: { id: "fix_oil_pump", type: "resolution", severity: "HIGH", title: "Oil Pump / Strainer Service", text: "Low mechanical oil pressure at idle.", action: "Drop the oil pan and inspect the oil strainer for blockage. Inspect the oil pump for worn rotors. Measure pump clearance per service manual. Replace pump if out of spec. Refill with factory oil grade and retest pressure.", partsNeeded: ["Oil pump assembly", "Oil pan gasket", "Oil strainer", "Engine oil and filter"], estimatedTime: "4-8 hours" },

            fix_oil_contam: { id: "fix_oil_contam", type: "resolution", severity: "HIGH", title: "Oil Contamination — Find Source", text: "Oil is diluted with fuel or water.", action: "Do NOT return to service. Milky oil = water intrusion (head gasket, cooling leak, or tall vent). Fuel smell = injector leak or bore wash. Investigate and repair the source, change oil and filter, and re-run diagnosis.", warning: "Running contaminated oil will destroy bearings.", partsNeeded: ["Engine oil and filter", "Replacement gaskets as identified"], estimatedTime: "Varies — several hours minimum" },

            fix_lanyard_switch: { id: "fix_lanyard_switch", type: "resolution", severity: "LOW", title: "Replace Lanyard Switch", text: "Lanyard switch contacts stuck.", action: "Replace the helm lanyard switch. Route wiring away from water paths. Apply dielectric grease to the connector. Test operation — engine must stop with clip removed and run with clip installed.", partsNeeded: ["Engine stop lanyard switch", "Dielectric grease"], estimatedTime: "30-60 minutes" },

            fix_shift_cut: { id: "fix_shift_cut", type: "resolution", severity: "MEDIUM", title: "Replace Shift Cut Switch", text: "Shift cut switch sticky or open.", action: "Replace the shift cut switch. Verify actuator geometry. Test shift under load on muffs or in water — ignition should retard briefly as the shifter crosses the detent.", partsNeeded: ["Shift cut switch"], estimatedTime: "1-2 hours" },

            fix_thermoswitch: { id: "fix_thermoswitch", type: "resolution", severity: "MEDIUM", title: "Replace Thermoswitch", text: "Thermoswitch doesn't actuate at spec temperature.", action: "Replace the thermoswitch with the correct Yamaha part. Apply dielectric grease. Verify after installation: warm the engine and confirm the switch closes near spec temperature (verify per your service manual).", partsNeeded: ["Thermoswitch", "Dielectric grease"], estimatedTime: "30-90 minutes" },

            fix_ecm_check: { id: "fix_ecm_check", type: "resolution", severity: "HIGH", title: "ECM Check", text: "All sensors and wiring check good — suspect ECM.", action: "Before replacing the ECM: verify ECM power, ground, and the 5V reference output at the ECM connector. Inspect every ECM connector pin for spread contacts or water intrusion. If all checks pass, bench-test or substitute a known-good ECM before ordering a replacement. ECMs are expensive and are seldom the actual failure.", warning: "Replace the ECM only after wiring, grounds, and sensors are confirmed good.", partsNeeded: ["ECM (only if confirmed)"], estimatedTime: "2-4 hours diagnostic" },

            fix_ecm_power: { id: "fix_ecm_power", type: "resolution", severity: "MEDIUM", title: "ECM Power Supply Repair", text: "ECM is seeing voltage dropouts.", action: "Trace power from battery through main fuses to ECM. Clean battery posts, replace corroded cables, torque all connections. Load-test the battery. Re-check charging voltage at 1500 RPM (13.8–14.8V).", partsNeeded: ["Battery cables (if damaged)", "Main fuses", "Dielectric grease"], estimatedTime: "1-3 hours" },

            clear_and_retest: { id: "clear_and_retest", type: "resolution", severity: "LOW", title: "Clear Codes and Retest", text: "Fault was transient or already resolved.", action: "Clear stored codes via the flash indicator procedure or YDS. Run the engine through a full idle → WOT → idle cycle and re-check for any codes. Document in the service record.", partsNeeded: [], estimatedTime: "15-30 minutes" }
        }
    }

};
