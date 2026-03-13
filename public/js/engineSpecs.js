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
        name: "Yamaha F115 (4-Stroke)",
        manufacturer: "Yamaha",
        years: "2014–2025",
        cylinders: "4 (Inline)",
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
        notes: [],
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
        name: "Yamaha F150 (4-Stroke)",
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
