// js/engineSpecs.js
//
// Engine specification database.
// Each entry contains all the key specs a field tech needs.

window.engineSpecDatabase = [

    // =============================================
    // MERCURY ENGINES
    // =============================================

    {
        name: "Mercury 115 FourStroke",
        manufacturer: "Mercury",
        years: "2018–2025",
        cylinders: "4 (Inline)",
        displacement: "2.1L (2100cc)",
        fuelSystem: "EFI — Multi-point electronic fuel injection",
        ignition: "CDI with individual coil-on-plug",
        firingOrder: "1-3-4-2",
        gearRatio: "2.38:1",
        controlSystem: "SmartCraft",
        diagnosticTool: "Mercury CDS G3",
        idleNeutral: "600–700 RPM",
        idleInGear: "550–650 RPM",
        wotRange: "5200–6000 RPM",
        sparkPlug: "NGK LZKAR6AP-11 (verify for your serial #)",
        sparkGap: "0.040 in (1.0mm)",
        sparkTorque: "13 lb-ft",
        fuelPressure: "39–42 PSI",
        injectorResistance: "12–16 ohms",
        compressionNormal: "185–210 PSI",
        compressionMin: "170 PSI",
        compressionVariation: "Within 10% across all cylinders",
        oilType: "Mercury 25W-40 Marine (or equivalent FC-W rated)",
        oilCapacity: "4.0 quarts with filter",
        oilPressureIdle: "25+ PSI",
        oilPressureWOT: "45–65 PSI",
        thermostatOpens: "143°F (62°C)",
        normalTemp: "143–170°F",
        overheatAlarm: "200°F (93°C)",
        chargingType: "Belt-driven alternator",
        chargingOutput: "60A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "18.5 oz",
        gearOilType: "Mercury High Performance Gear Lube",
        notes: [],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter / water separator",
                    "Inspect spark plugs — replace if needed",
                    "Grease all fittings (6 points typical)",
                    "Inspect water pump tell-tale flow",
                    "Check battery and charging system",
                    "Inspect fuel system for leaks",
                    "Check and adjust idle RPM",
                    "Change gear oil — inspect for water contamination",
                    "Check anode condition — replace if 50% eroded"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller and wear plate",
                    "Replace all spark plugs",
                    "Replace fuel lines and hoses if deteriorated",
                    "Inspect and replace thermostat(s)",
                    "Replace timing belt (if applicable to this model)"
                ]
            }
        ]
    },

    {
        name: "Mercury 150 FourStroke",
        manufacturer: "Mercury",
        years: "2018–2025",
        cylinders: "4 (Inline)",
        displacement: "3.0L (3000cc)",
        fuelSystem: "EFI — Multi-point electronic fuel injection",
        ignition: "CDI with individual coil-on-plug",
        firingOrder: "1-3-4-2",
        gearRatio: "2.08:1",
        controlSystem: "SmartCraft",
        diagnosticTool: "Mercury CDS G3",
        idleNeutral: "600–700 RPM",
        idleInGear: "550–650 RPM",
        wotRange: "5200–6000 RPM",
        sparkPlug: "NGK LZKAR6AP-11 (verify for your serial #)",
        sparkGap: "0.040 in (1.0mm)",
        sparkTorque: "13 lb-ft",
        fuelPressure: "39–42 PSI",
        injectorResistance: "12–16 ohms",
        compressionNormal: "185–210 PSI",
        compressionMin: "170 PSI",
        compressionVariation: "Within 10% across all cylinders",
        oilType: "Mercury 25W-40 Marine (or equivalent FC-W rated)",
        oilCapacity: "5.0 quarts with filter",
        oilPressureIdle: "25+ PSI",
        oilPressureWOT: "45–65 PSI",
        thermostatOpens: "143°F (62°C)",
        normalTemp: "143–170°F",
        overheatAlarm: "200°F (93°C)",
        chargingType: "Belt-driven alternator",
        chargingOutput: "60A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "18.6 oz",
        gearOilType: "Mercury High Performance Gear Lube",
        notes: [],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter / water separator",
                    "Inspect spark plugs",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Inspect fuel system for leaks",
                    "Change gear oil",
                    "Check anodes"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller and wear plate",
                    "Replace all spark plugs",
                    "Replace thermostat(s)",
                    "Inspect all fuel hoses"
                ]
            }
        ]
    },

    {
        name: "Mercury V8 250 FourStroke",
        manufacturer: "Mercury",
        years: "2018–2025",
        cylinders: "8 (V8)",
        displacement: "4.6L (4600cc)",
        fuelSystem: "EFI — Sequential multi-point fuel injection",
        ignition: "Coil-on-plug, individual coils",
        firingOrder: "1-5-4-8-3-7-2-6",
        gearRatio: "1.75:1",
        controlSystem: "SmartCraft / VesselView",
        diagnosticTool: "Mercury CDS G3",
        idleNeutral: "600–700 RPM",
        idleInGear: "550–650 RPM",
        wotRange: "5200–6000 RPM",
        sparkPlug: "NGK DILKAR7G-11GS (verify for serial #)",
        sparkGap: "0.043 in (1.1mm)",
        sparkTorque: "13 lb-ft",
        fuelPressure: "39–42 PSI",
        injectorResistance: "12–16 ohms",
        compressionNormal: "180–210 PSI",
        compressionMin: "160 PSI",
        compressionVariation: "Within 10%",
        oilType: "Mercury 25W-40 Marine (FC-W rated)",
        oilCapacity: "8.0 quarts with filter",
        oilPressureIdle: "25+ PSI",
        oilPressureWOT: "45–65 PSI",
        thermostatOpens: "143°F (62°C)",
        normalTemp: "143–175°F",
        overheatAlarm: "205°F (96°C)",
        chargingType: "Belt-driven alternator",
        chargingOutput: "70A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "21.5 oz",
        gearOilType: "Mercury High Performance Gear Lube",
        notes: [
            "The V8 4.6L platform is shared between the 250 and 300 HP versions",
            "The 300 HP version uses a different ECM calibration and gear ratio (1.60:1)"
        ],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter / water separator",
                    "Inspect spark plugs",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Inspect fuel system for leaks",
                    "Change gear oil",
                    "Check anodes",
                    "Inspect drive belts"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller and wear plate",
                    "Replace all spark plugs",
                    "Replace thermostat(s)",
                    "Replace drive belts",
                    "Inspect all fuel hoses"
                ]
            }
        ]
    },

    {
        name: "Mercury Verado 300 (Supercharged)",
        manufacturer: "Mercury",
        years: "2018–2025",
        cylinders: "6 (Inline, Supercharged)",
        displacement: "2.6L (2600cc) Supercharged",
        fuelSystem: "DFI — Direct Fuel Injection with supercharger",
        ignition: "Coil-on-plug, waste spark",
        firingOrder: "1-4-2-5-3-6",
        gearRatio: "1.60:1",
        controlSystem: "SmartCraft / VesselView",
        diagnosticTool: "Mercury CDS G3",
        idleNeutral: "600–700 RPM",
        idleInGear: "550–650 RPM",
        wotRange: "5800–6400 RPM",
        sparkPlug: "Champion RC10PYP4 (or Mercury OEM)",
        sparkGap: "0.040 in (1.0mm)",
        sparkTorque: "18 lb-ft",
        fuelPressure: "Low pressure: 39–43 PSI | High pressure (at rail): 87 PSI",
        injectorResistance: "Check model-specific spec — DFI injectors differ from EFI",
        compressionNormal: "170–200 PSI",
        compressionMin: "150 PSI",
        compressionVariation: "Within 10%",
        oilType: "Mercury Verado 25W-50 Synthetic — REQUIRED, do not substitute",
        oilCapacity: "7.0 quarts with filter",
        oilPressureIdle: "30+ PSI",
        oilPressureWOT: "50–70 PSI",
        thermostatOpens: "143°F (62°C)",
        normalTemp: "143–180°F",
        overheatAlarm: "205°F (96°C)",
        chargingType: "Belt-driven alternator",
        chargingOutput: "70A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "21.0 oz",
        gearOilType: "Mercury High Performance Gear Lube",
        notes: [
            "Verado uses ELECTRIC power steering (AMP) — NOT hydraulic",
            "Verado has a separate midsection oil reservoir — check level at every service",
            "The supercharger belt MUST be inspected every 100 hours and replaced per schedule",
            "DFI (Direct Fuel Injection) engines are more sensitive to fuel quality than standard EFI",
            "Charge air cooler (intercooler) is seawater-cooled — inspect for salt buildup",
            "Must use Verado-specific synthetic oil — standard marine oil will cause problems"
        ],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter (Verado 25W-50 Synthetic ONLY)",
                    "Check midsection oil level",
                    "Replace fuel filter / water separator",
                    "Inspect spark plugs",
                    "Inspect supercharger belt — replace if worn, cracked, or glazed",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Inspect charge air cooler for salt buildup",
                    "Change gear oil",
                    "Check anodes"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller and wear plate",
                    "Replace all spark plugs",
                    "Replace supercharger belt",
                    "Replace thermostat(s)",
                    "Inspect/clean charge air cooler",
                    "Inspect all fuel hoses",
                    "Change midsection oil"
                ]
            }
        ]
    },

    // =============================================
    // YAMAHA ENGINES
    // =============================================

    {
        name: "Yamaha F115C / LF115C (factory manual)",
        manufacturer: "Yamaha",
        years: "2003–2013 (F115C/LF115C platform). Factory service manual: Yamaha 68V-28197-1F-11.",
        cylinders: "4 (Inline) — DOHC 16V",
        displacement: "1.74L (1741cc), bore × stroke 79.0 × 88.8 mm (3.11 × 3.50 in)",
        fuelSystem: "EFI — Electronic fuel injection",
        ignition: "TCI (Transistor Controlled Ignition)",
        firingOrder: "1-3-4-2",
        gearRatio: "2.15:1 (28/13)",
        controlSystem: "Command Link / Remote control",
        diagnosticTool: "Yamaha YDS; diagnostic flash indicator via test lead YB-06795",
        idleNeutral: "750 ± 50 RPM",
        idleInGear: "700 ± 50 RPM (approx — verify per HIN)",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK LFR6A-11",
        sparkGap: "0.039–0.043 in (1.0–1.1 mm)",
        sparkTorque: "25 Nm (18 ft-lb)",
        fuelPressure: "~40 PSI (verify via YDS fuel pressure reading)",
        injectorResistance: "Verify at the injector per service manual schedule",
        compressionNormal: "Factory reference only — varies with altitude/temp",
        compressionMin: "950 kPa (135 PSI) at WOT, 68°F, plugs removed",
        compressionVariation: "Within 10% across all cylinders",
        oilType: "4-stroke motor oil, API SE/SF/SG/SH/SJ, SAE 10W-30 or 10W-40 (Yamalube 4M preferred)",
        oilCapacity: "4.5 L (4.76 US qt) with filter; 4.3 L without",
        oilPressureIdle: "350 kPa (49.8 PSI) @ idle, 55°C (factory reference)",
        oilPressureWOT: "See factory curve in service manual",
        thermostatOpens: "48–52°C (118–126°F); fully open 60°C (140°F); valve open lower limit 4.3 mm",
        normalTemp: "Steady after warmup, below overheat alarm",
        overheatAlarm: "Fail-safe behavior via thermoswitch (code 46)",
        chargingType: "Permanent magnet stator + rectifier/regulator",
        chargingOutput: "25A",
        chargingVoltage: "13.8–14.8V (F115 regulator min: 12.5V @1500, 13.0V @3500 peak)",
        gearOilCapacity: "760 cc / 25.7 US oz (F115TR regular rot); 715 cc / 24.2 US oz (LF115TR counter-rot)",
        gearOilType: "Yamaha GEAR CASE LUBE, SAE 90",
        notes: [
            "FACTORY MANUAL: Yamaha 68V-28197-1F-11 (1st ed. October 2003)",
            "• Battery minimum: CCA 380, MCA 502, RC 124 minutes",
            "• Fuel: regular unleaded (PON 86 / RON 91)",
            "• Trim angle: -4° to 16°; tilt-up 70°; steering 30° + 30°",
            "• Ignition timing range: 4° ATDC — 20° BTDC",
            "• Valve clearance (cold): intake 0.20 ± 0.03 mm, exhaust 0.34 ± 0.03 mm",
            "• TPS output at idle stop (P–B): 0.732 ± 0.014 V",
            "• Engine temp sensor: 4.62 kΩ @ 5°C, 2.44 kΩ @ 20°C, 0.19 kΩ @ 100°C",
            "• Pulser coil peak voltage: cranking loaded 3.0V, 26V @1500 rpm, 44V @3500 rpm",
            "• ECM output peak voltage: cranking loaded 122V, @1500 rpm 242V, @3500 rpm 245V",
            "• Flywheel magnet nut: 186 Nm (137 ft-lb). Oil filter: 18 Nm. Spark plug: 25 Nm.",
            "• Pinion nut: 93 Nm (67 ft-lb). Propeller nut: 55 Nm (40 ft-lb).",
            "• Cylinder head (M10, 1.5 pitch): 1st 15 Nm, 2nd 30 Nm, 3rd turn 90°",
            "• Connecting rod cap (M8): 1st 15 Nm, 2nd turn 60°",
            "• Timing belt tensioner (M10): 40 Nm. Drive sprocket (M40): 265 Nm.",
            "• Ring nut (M101.5): 105 Nm. Impeller housing (M8): 18 Nm.",
            "• Starting system fuses: 20A and 30A"
        ],
        maintenance: [
            {
                interval: "Initial — 20 Hours",
                tasks: [
                    "Change engine oil and filter (4.5 L with filter)",
                    "Retorque cylinder head bolts per service manual sequence",
                    "Check all fluid levels",
                    "Inspect control cable adjustment"
                ]
            },
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace external fuel filter / water separator",
                    "Inspect spark plugs — NGK LFR6A-11, gap 1.0–1.1 mm",
                    "Grease all fittings",
                    "Inspect water pump tell-tale — steady pencil-width stream at idle",
                    "Check battery and charging system (25A alternator)",
                    "Inspect fuel lines and connections",
                    "Change gear oil (760 cc / 25.7 US oz) — check for water contamination",
                    "Inspect anodes — replace if 2/3 eroded",
                    "Clean and inspect thermostat (48–52°C opens)",
                    "Check idle RPM (750 ± 50)",
                    "Read and clear any diagnostic codes via flash indicator / YDS"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller (torque impeller housing M8 to 18 Nm)",
                    "Replace all spark plugs",
                    "Replace fuel hoses if deteriorated",
                    "Replace thermostat",
                    "Check valve clearances (cold: I 0.20, E 0.34 mm)",
                    "Inspect timing belt — replace per Yamaha interval"
                ]
            }
        ]
    },

    {
        name: "Yamaha F115 (2014+ platform)",
        manufacturer: "Yamaha",
        years: "2014–2025",
        cylinders: "4 (Inline) — DOHC 16V",
        displacement: "1.8L (1832cc)",
        fuelSystem: "EFI — Multi-point electronic fuel injection",
        ignition: "TCI (Transistor Controlled Ignition), coil-on-plug",
        firingOrder: "1-3-4-2",
        gearRatio: "2.09:1",
        controlSystem: "Command Link",
        diagnosticTool: "Yamaha YDS",
        idleNeutral: "650–700 RPM",
        idleInGear: "600–650 RPM",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK LKR7E (verify for your model year)",
        sparkGap: "0.039–0.043 in (1.0–1.1mm)",
        sparkTorque: "13 lb-ft",
        fuelPressure: "36–44 PSI",
        injectorResistance: "11.6–12.4 ohms at 68°F",
        compressionNormal: "185–213 PSI",
        compressionMin: "171 PSI",
        compressionVariation: "Within 10%",
        oilType: "Yamalube 4M 10W-30 (FC-W rated)",
        oilCapacity: "3.7 quarts with filter",
        oilPressureIdle: "14+ PSI",
        oilPressureWOT: "43–71 PSI",
        thermostatOpens: "140°F (60°C)",
        normalTemp: "140–176°F",
        overheatAlarm: "203°F (95°C)",
        chargingType: "Permanent magnet stator + rectifier/regulator",
        chargingOutput: "28A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "14.1 oz",
        gearOilType: "Yamalube Marine Gear Oil",
        notes: [
            "This entry covers the 2014+ F115 platform (1.8L, 16-valve DOHC).",
            "For the earlier F115C / LF115C (2003–2013, 1.74L), see the 'Yamaha F115C / LF115C (factory manual)' entry."
        ],
        maintenance: [
            {
                interval: "Initial — 20 Hours",
                tasks: [
                    "Change engine oil and filter",
                    "Retorque cylinder head bolts (if specified)",
                    "Check all fluid levels"
                ]
            },
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter (external and VST internal)",
                    "Inspect spark plugs",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Inspect fuel lines and connections",
                    "Change gear oil — check for water contamination",
                    "Inspect anodes — replace if 2/3 eroded",
                    "Clean and inspect thermostat",
                    "Check idle RPM"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller",
                    "Replace all spark plugs",
                    "Replace fuel hoses if deteriorated",
                    "Replace thermostat(s)",
                    "Check valve clearances"
                ]
            }
        ]
    },

    {
        name: "Yamaha F150TR / LF150TR (factory manual)",
        manufacturer: "Yamaha",
        years: "F150TR / LF150TR 63P-series (mid-2000s to early-2010s). Factory service manual: Yamaha 63P1F11.",
        cylinders: "4 (Inline) — DOHC 16V",
        displacement: "2.67L (2670cc), bore × stroke 94.0 × 96.2 mm (3.70 × 3.79 in)",
        fuelSystem: "EFI — Fuel injection",
        ignition: "TCI",
        firingOrder: "1-3-4-2",
        gearRatio: "2.00:1 (28/14)",
        controlSystem: "Command Link / Remote control",
        diagnosticTool: "Yamaha YDS; diagnostic flash indicator via test lead YB-06795",
        idleNeutral: "700 ± 50 RPM",
        idleInGear: "~650 RPM (verify per HIN)",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK LFR5A-11",
        sparkGap: "0.039–0.043 in (1.0–1.1 mm)",
        sparkTorque: "25 Nm (18.4 ft-lb)",
        fuelPressure: "~40 PSI (verify via YDS fuel pressure reading)",
        injectorResistance: "14.0–15.0 Ω @ 20°C",
        compressionNormal: "Factory reference only — varies with altitude/temp",
        compressionMin: "880 kPa (128 PSI) at WOT, 68°F, plugs removed",
        compressionVariation: "Within 10% across all cylinders",
        oilType: "4-stroke motor oil, API SE/SF/SG/SH/SJ, SAE 10W-30 or 10W-40",
        oilCapacity: "5.4 L (5.7 US qt) with filter; 5.2 L without",
        oilPressureIdle: "450 kPa (65.3 PSI) at idle (factory reference)",
        oilPressureWOT: "See factory curve",
        thermostatOpens: "58–62°C (136–144°F); fully open 70°C (158°F); valve open lower limit 4.3 mm",
        normalTemp: "Steady after warmup, below overheat alarm",
        overheatAlarm: "Fail-safe limits engine speed to ~2,000 RPM on overheat",
        chargingType: "Permanent magnet stator + rectifier/regulator",
        chargingOutput: "35A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "980 cc / 33.1 US oz (F150TR regular rot); 870 cc / 29.4 US oz (LF150TR counter-rot)",
        gearOilType: "Yamaha GEAR CASE LUBE, SAE 90",
        notes: [
            "FACTORY MANUAL: Yamaha 63P1F11",
            "• Compression ratio 9.0",
            "• Ignition timing (cyl #1): TDC at engine idle speed",
            "• Battery minimum: CCA 512, MCA 675, RC 182 minutes",
            "• Fuel: regular unleaded (PON 86 / RON 91)",
            "• Trim angle: -4° to 16°; tilt-up 70°; steering 35° + 35°",
            "• TPS output at idle (P–B): 0.70 ± 0.02 V; input 5V",
            "• Engine temp sensor: 54.2–69.0 kΩ @ 20°C, 3.12–3.48 kΩ @ 100°C",
            "• Intake air temp sensor: 2.20–2.70 kΩ @ 20°C",
            "• Ignition coil primary: 1.53–2.07 Ω; secondary: 12.50–16.91 kΩ @ 20°C",
            "• Pulser coil resistance: 459–561 Ω; air gap 0.3–0.7 mm",
            "• Pulser coil peak voltage: cranking loaded 3.6V, @1500 rpm 23.9V, @3500 rpm 49.7V",
            "• ECM output peak voltage: cranking loaded 260V, @1500 rpm 260V, @3500 rpm 270V",
            "• Flywheel magnet nut (M24): 270 Nm (199 ft-lb). Oil filter: 18 Nm. Spark plug: 25 Nm.",
            "• Cylinder head bolts — M10 sequence: 1st 19 Nm, 2nd 37 Nm, 3rd turn 90°",
            "• Camshaft cap bolt (M7): 1st 8 Nm, 2nd 17 Nm",
            "• Fuel rail / throttle body mounting (M8): 13 Nm",
            "• Ignition coil bolt (M6): 7 Nm. Timing belt tensioner: 39 Nm.",
            "• Driven sprocket (M10): 60 Nm. Starter motor bolt (M8): 29 Nm.",
            "• Balancer bolt (M8): 1st 18 Nm, 2nd 34 Nm. Thermostat cover (M6): 12 Nm.",
            "• Fail-safe behavior: limp to ~900 RPM fail-safe idle or ~2,000 RPM cap on overheat/low-oil/sensor fault"
        ],
        maintenance: [
            {
                interval: "Initial — 20 Hours",
                tasks: [
                    "Change engine oil and filter (5.4 L with filter)",
                    "Retorque cylinder head bolts per service manual sequence",
                    "Check all fluid levels",
                    "Inspect control cable adjustment"
                ]
            },
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace external fuel filter / water separator",
                    "Inspect spark plugs — NGK LFR5A-11, gap 1.0–1.1 mm",
                    "Grease all fittings",
                    "Inspect water pump tell-tale — pencil-width stream at idle",
                    "Check battery and charging system (35A alternator)",
                    "Inspect fuel lines and connections",
                    "Change gear oil (980 cc / 33.1 US oz) — check for water contamination",
                    "Inspect anodes — replace if 2/3 eroded",
                    "Clean and inspect thermostat (58–62°C opens)",
                    "Check idle RPM (700 ± 50)",
                    "Read and clear any diagnostic codes via flash indicator / YDS"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller",
                    "Replace all spark plugs",
                    "Replace fuel hoses if deteriorated",
                    "Replace thermostat",
                    "Check valve clearances",
                    "Inspect timing belt — replace per Yamaha interval"
                ]
            }
        ]
    },

    {
        name: "Yamaha F150 (current platform)",
        manufacturer: "Yamaha",
        years: "2019–2025",
        cylinders: "4 (Inline)",
        displacement: "2.7L (2670cc)",
        fuelSystem: "EFI — Multi-point electronic fuel injection",
        ignition: "TCI, coil-on-plug",
        firingOrder: "1-3-4-2",
        gearRatio: "2.00:1",
        controlSystem: "Command Link / Command Link Plus",
        diagnosticTool: "Yamaha YDS",
        idleNeutral: "600–700 RPM",
        idleInGear: "550–650 RPM",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK LKR7E (verify for your model year)",
        sparkGap: "0.039–0.043 in",
        sparkTorque: "13 lb-ft",
        fuelPressure: "36–44 PSI",
        injectorResistance: "11.6–12.4 ohms at 68°F",
        compressionNormal: "185–213 PSI",
        compressionMin: "171 PSI",
        compressionVariation: "Within 10%",
        oilType: "Yamalube 4M 10W-30 (FC-W rated)",
        oilCapacity: "5.3 quarts with filter",
        oilPressureIdle: "14+ PSI",
        oilPressureWOT: "43–71 PSI",
        thermostatOpens: "140°F (60°C)",
        normalTemp: "140–176°F",
        overheatAlarm: "203°F (95°C)",
        chargingType: "Permanent magnet stator + rectifier/regulator",
        chargingOutput: "40A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "14.8 oz",
        gearOilType: "Yamalube Marine Gear Oil",
        notes: [
            "This entry covers the 2019+ F150 current platform.",
            "For the earlier F150TR / LF150TR (63P series, 2000s-era), see the 'Yamaha F150TR / LF150TR (factory manual)' entry.",
            "The VST (Vapor Separator Tank) contains the high-pressure fuel pump — a common failure point",
            "VST float valve sticking can cause flooding or no-start conditions",
            "Ethanol fuel can damage VST components over time"
        ],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter",
                    "Inspect spark plugs",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Inspect fuel system",
                    "Change gear oil",
                    "Check anodes"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller",
                    "Replace all spark plugs",
                    "Replace thermostat(s)",
                    "Check valve clearances",
                    "Inspect fuel hoses"
                ]
            }
        ]
    },

    {
        name: "Yamaha F200 V6 (3.3L)",
        manufacturer: "Yamaha",
        years: "F200TR / LF200TR (69J series, older 3.3L V6 platform). Current F200 inline-4 V MAX platform uses different specs.",
        cylinders: "6 (V6) — DOHC 24V",
        displacement: "3.3L (3352cc), bore × stroke 94.0 × 80.5 mm (3.70 × 3.17 in)",
        fuelSystem: "EFI — Electronic fuel injection",
        ignition: "Microcomputer TCI with coil-on-plug",
        firingOrder: "1-2-3-4-5-6 (V6, bank-order — verify per YDS)",
        gearRatio: "2.00:1 (30/15)",
        controlSystem: "Command Link / Remote control",
        diagnosticTool: "Yamaha YDS; diagnostic flash indicator (test lead YB-06795)",
        idleNeutral: "650–750 RPM",
        idleInGear: "600–700 RPM",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK LFR5A-11",
        sparkGap: "0.039–0.043 in (1.0–1.1 mm)",
        sparkTorque: "25 Nm (18 ft-lb)",
        fuelPressure: "~40 PSI (verify via YDS fuel pressure reading)",
        injectorResistance: "14.0–15.0 Ω @ 20°C (per same platform)",
        compressionNormal: "Factory reference only — varies with altitude/temp",
        compressionMin: "880 kPa (125 PSI) at WOT, 68°F, plugs removed",
        compressionVariation: "Within 10% across all cylinders",
        oilType: "Yamalube 4M 10W-30 or 10W-40 (SE/SF/SG/SH/SJ)",
        oilCapacity: "6.0 L (6.3 US qt) with filter; 5.8 L without",
        oilPressureIdle: "650 kPa (~94 PSI) at 700 RPM (factory reference)",
        oilPressureWOT: "See factory curve",
        thermostatOpens: "58–62°C (136–144°F); fully open 70°C (158°F); valve open lower limit 4.3 mm",
        normalTemp: "Steady after warmup, well below overheat alarm",
        overheatAlarm: "Fail-safe limits speed to ~2000 RPM on overheat",
        chargingType: "Permanent magnet stator + rectifier/regulator",
        chargingOutput: "45A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "1.15 L / 38.9 US oz (regular rot, F200TR/F225TR); 1.00 L / 33.8 US oz (counter-rot, LF200TR/LF225TR)",
        gearOilType: "Yamaha GEAR CASE LUBE, SAE 90",
        notes: [
            "FACTORY MANUAL SPECS (F200TR / LF200TR / F225TR / LF225TR, Yamaha 69J1D11):",
            "• V6 4-stroke, DOHC, 24 valves, compression ratio 9.9",
            "• Ignition timing: F200 TDC–BTDC 21°; F225 TDC–BTDC 24°",
            "• Fuel: regular unleaded (PON 86 / RON 91)",
            "• Battery min: CCA 512, MCA 675, RC 182 min",
            "• Fail-safe / warning control: engine speed limited to ~2,000 RPM on overheat, low oil pressure, or sensor faults; fuel injection is cut above 6,200 RPM (over-rev protection)",
            "• Warning control mode deactivates when engine speed < 1,600 RPM or throttle closes",
            "• ECM controls ignition timing, fuel injection timing, fuel injection volume, and ISC (idle speed control)",
            "• Self-diagnosis via diagnostic flash indicator (test lead YB-06795) — same code chart as F115/F150",
            "• Valve open lower limit (thermostat): 4.3 mm (0.17 in)",
            "• On V6 platform, 6 ignition coils (coil-on-plug). Check individually.",
            "• Always confirm specs against your specific HIN / primary ID tag — Yamaha revises service limits."
        ],
        maintenance: [
            {
                interval: "Initial — 20 Hours",
                tasks: [
                    "Change engine oil and filter",
                    "Check all fluid levels",
                    "Inspect fasteners for proper torque",
                    "Check control cable adjustment"
                ]
            },
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter (6.0 L with filter)",
                    "Replace fuel filter (external and VST internal)",
                    "Inspect all 6 spark plugs (NGK LFR5A-11)",
                    "Grease all fittings",
                    "Inspect water pump tell-tale — pencil-width stream",
                    "Check battery and charging system (45A output)",
                    "Inspect fuel lines and connections",
                    "Change gear oil — check for water contamination",
                    "Inspect anodes — replace if 2/3 eroded",
                    "Clean and inspect thermostat",
                    "Check idle RPM (650–750 in neutral)",
                    "Read and clear any diagnostic codes via YDS"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller",
                    "Replace all 6 spark plugs",
                    "Replace fuel hoses if deteriorated",
                    "Replace thermostat(s) — 2 on V6",
                    "Check valve clearances",
                    "Inspect timing belt condition"
                ]
            }
        ]
    },

    {
        name: "Yamaha F250 V6 (4.2L)",
        manufacturer: "Yamaha",
        years: "2019–2025",
        cylinders: "6 (V6)",
        displacement: "4.2L (4169cc)",
        fuelSystem: "EFI — Sequential multi-point fuel injection",
        ignition: "TCI, coil-on-plug",
        firingOrder: "1-4-5-2-3-6",
        gearRatio: "1.75:1",
        controlSystem: "Command Link Plus / Helm Master",
        diagnosticTool: "Yamaha YDS",
        idleNeutral: "600–700 RPM",
        idleInGear: "550–650 RPM",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK LZKAR7A (verify for your model year)",
        sparkGap: "0.039–0.043 in",
        sparkTorque: "13 lb-ft",
        fuelPressure: "36–44 PSI",
        injectorResistance: "11.6–12.4 ohms at 68°F",
        compressionNormal: "185–213 PSI",
        compressionMin: "170 PSI",
        compressionVariation: "Within 10%",
        oilType: "Yamalube 4M 10W-30 (FC-W rated)",
        oilCapacity: "7.4 quarts with filter",
        oilPressureIdle: "14+ PSI",
        oilPressureWOT: "43–71 PSI",
        thermostatOpens: "140°F (60°C)",
        normalTemp: "140–176°F",
        overheatAlarm: "203°F (95°C)",
        chargingType: "Stator + rectifier/regulator",
        chargingOutput: "50A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "21.1 oz",
        gearOilType: "Yamalube Marine Gear Oil",
        notes: [
            "4.2L V6 platform is shared with the F300 V6 (different calibration)",
            "Variable camshaft timing (VCT) on intake cams",
            "Integrated electric steering available with Helm Master system",
            "In-bank exhaust system design"
        ],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter",
                    "Inspect spark plugs",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Change gear oil",
                    "Check anodes"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller",
                    "Replace all spark plugs",
                    "Replace thermostat(s)",
                    "Check valve clearances",
                    "Inspect fuel hoses"
                ]
            }
        ]
    },

    {
        name: "Yamaha F300 V8 (5.3L)",
        manufacturer: "Yamaha",
        years: "2020–2025",
        cylinders: "8 (V8)",
        displacement: "5.3L (5330cc)",
        fuelSystem: "EFI — Sequential multi-point with drive-by-wire throttle",
        ignition: "TCI, coil-on-plug",
        firingOrder: "1-8-4-3-6-5-7-2",
        gearRatio: "1.73:1",
        controlSystem: "Command Link Plus / Helm Master",
        diagnosticTool: "Yamaha YDS",
        idleNeutral: "600–650 RPM",
        idleInGear: "550–600 RPM",
        wotRange: "5000–6000 RPM",
        sparkPlug: "NGK (model-specific — verify with YDS or service manual)",
        sparkGap: "0.039–0.043 in",
        sparkTorque: "13 lb-ft",
        fuelPressure: "36–44 PSI",
        injectorResistance: "11.6–12.4 ohms at 68°F",
        compressionNormal: "185–213 PSI",
        compressionMin: "170 PSI",
        compressionVariation: "Within 10%",
        oilType: "Yamalube 4M 10W-30 (FC-W rated)",
        oilCapacity: "8.5 quarts with filter",
        oilPressureIdle: "14+ PSI",
        oilPressureWOT: "43–71 PSI",
        thermostatOpens: "140°F (60°C)",
        normalTemp: "140–176°F",
        overheatAlarm: "203°F (95°C)",
        chargingType: "Stator + rectifier/regulator",
        chargingOutput: "50A",
        chargingVoltage: "13.8–14.8V",
        gearOilCapacity: "24.7 oz",
        gearOilType: "Yamalube Marine Gear Oil",
        notes: [
            "Yamaha's largest outboard V8 — 5.3L naturally aspirated",
            "Drive-by-wire throttle system — no mechanical throttle cable",
            "Integrated electric steering with Helm Master",
            "Dual-louver exhaust relief system",
            "Must use Yamaha YDS for advanced diagnostics and calibrations"
        ],
        maintenance: [
            {
                interval: "Every 100 Hours or Annually",
                tasks: [
                    "Change engine oil and filter",
                    "Replace fuel filter",
                    "Inspect spark plugs",
                    "Grease all fittings",
                    "Inspect water pump tell-tale",
                    "Check battery and charging system",
                    "Change gear oil",
                    "Check anodes",
                    "Inspect drive-by-wire throttle system"
                ]
            },
            {
                interval: "Every 300 Hours or 3 Years",
                tasks: [
                    "Replace water pump impeller",
                    "Replace all spark plugs",
                    "Replace thermostat(s)",
                    "Check valve clearances",
                    "Inspect fuel hoses",
                    "Inspect steering actuator (Helm Master)"
                ]
            }
        ]
    }

];
