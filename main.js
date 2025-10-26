const os = require("os");
const inquirer = require("inquirer");
const { exec, spawn } = require("child_process");
const open = require("open");
const http = require("http");
const dgram = require("dgram");
const net = require("net");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;
const { parseStringPromise } = require("xml2js");
const readline = require("readline");

const SERVER_PORT = 3000;
const AVR_CONTROL_PORT = 1256;
const MAIN_CONFIG = { timeouts: { discovery: 5000, connection: 3000, command: 10000 } };
const rewApiPort = 4735;
const TRANSFER_CONFIG = {
    files: { filters: "filter.oca" },
    target: { ip: null, port: AVR_CONTROL_PORT },
    targetCurves: ["00", "01"],
    sampleRates: ["00", "01", "02"],
    timeouts: {
        connect: 5000,
        command: 5000,
        finalize: 15000,
        enterCalibration: 3000,
        nonAckPacket: 50,
        power: 12500,
    },
};
const TELNET_CONFIG = {
    connectTimeout: 5000,
    commandTimeout: 3000,
    queryResponseTimeout: 3500,
    presetQueryTimeout: 5000,
    powerOnDelay: 5000,
    setCommandSettleTime: 750,
    maxRetries: 0,
};
const MEASUREMENT_CONFIG = {
    timeouts: {
        connect: 5000,
        command: 10000,
        enterCalibration: 3000,
        startChannel: 12000,
        getResponse: 20000,
    },
};
const BYTES_PER_FLOAT = 4;
const DECIMATION_FACTOR = 4;
const decFilterXT32Sub29_taps = [
    -0.0000068090826, -4.5359936e-8, 0.00010496614, 0.0005359394, 0.0017366897, 0.0043950975,
    0.00936928, 0.017480986, 0.029199528, 0.04430621, 0.061674833, 0.07929655, 0.094606727,
    0.1050576, 0.10877161, 0.1050576, 0.094606727, 0.07929655, 0.061674833, 0.04430621, 0.029199528,
    0.017480986, 0.00936928, 0.0043950975, 0.0017366897, 0.0005359394, 0.00010496614, -4.5359936e-8,
    -0.0000068090826,
];
const decFilterXT32Sub37_taps = [
    -0.000026230078, -0.00013839548, -0.00045447858, -0.0011429883, -0.0023770225, -0.0042346125,
    -0.0065577077, -0.0088115167, -0.010010772, -0.008782894, -0.0036095164, 0.0067711435,
    0.02289046, 0.04414973, 0.06865209, 0.093375608, 0.11469775, 0.12916237, 0.1342851, 0.12916237,
    0.11469775, 0.093375608, 0.06865209, 0.04414973, 0.02289046, 0.0067711435, -0.0036095164,
    -0.008782894, -0.010010772, -0.0088115167, -0.0065577077, -0.0042346125, -0.0023770225,
    -0.0011429883, -0.00045447858, -0.00013839548, -0.000026230078,
];
const decFilterXT32Sub93_taps = [
    0.000004904671, 0.000016451735, 0.000035466823, 0.000054780343, 0.000057436635, 0.000019883537,
    -0.00007663135, -0.00022867938, -0.0003953652, -0.0004970615, -0.00043803814, -0.00015296187,
    0.00033801072, 0.00089421676, 0.0012704487, 0.0011992522, 0.0005233042, -0.00067407207,
    -0.0020127299, -0.0028939669, -0.0027228948, -0.0012104996, 0.0013740772, 0.004148222,
    0.005850492, 0.005338624, 0.0021824592, -0.0029139882, -0.0081179589, -0.011018342,
    -0.0096052159, -0.0033266835, 0.0062539442, 0.015607043, 0.020322932, 0.016872915, 0.0044270838,
    -0.014038938, -0.031958703, -0.040876575, -0.033219177, -0.0052278917, 0.04104016, 0.097502038,
    0.15189469, 0.19119503, 0.20552149, 0.19119503, 0.15189469, 0.097502038, 0.04104016,
    -0.0052278917, -0.033219177, -0.040876575, -0.031958703, -0.014038938, 0.0044270838,
    0.016872915, 0.020322932, 0.015607043, 0.0062539442, -0.0033266835, -0.0096052159, -0.011018342,
    -0.0081179589, -0.0029139882, 0.0021824592, 0.005338624, 0.005850492, 0.004148222, 0.0013740772,
    -0.0012104996, -0.0027228948, -0.0028939669, -0.0020127299, -0.00067407207, 0.0005233042,
    0.0011992522, 0.0012704487, 0.00089421676, 0.00033801072, -0.00015296187, -0.00043803814,
    -0.0004970615, -0.0003953652, -0.00022867938, -0.00007663135, 0.000019883537, 0.000057436635,
    0.000054780343, 0.000035466823, 0.000016451735, 0.000004904671,
];
const decFilterXT32Sat129_taps = [
    0.0000043782347, 0.000014723354, 0.000032770109, 0.000054528296, 0.000068608439, 0.00005722275,
    0.0000025561833, -0.0001022896, -0.00024198946, -0.0003741896, -0.0004376953, -0.00037544663,
    -0.00016613922, 0.00014951751, 0.00046477153, 0.000636138, 0.0005427991, 0.00015503204,
    -0.0004217047, -0.00095836946, -0.0011810855, -0.00089615857, -0.00010969268, 0.0009218459,
    0.0017551293, 0.0019349628, 0.0012194271, -0.00024770317, -0.0019181528, -0.0030198381,
    -0.0028912309, -0.0013345525, 0.0011865027, 0.0036375371, 0.0048077558, 0.0038727189,
    0.00087827817, -0.0031111876, -0.0063393954, -0.0070888256, -0.0045305756, 0.00070328976,
    0.006557314, 0.010292898, 0.009696761, 0.0042538098, -0.0042899773, -0.012354134, -0.01590999,
    -0.012335026, -0.0019397299, 0.0116079, 0.022352377, 0.024387382, 0.014624386, -0.0051601734,
    -0.028005365, -0.043577183, -0.04166761, -0.016186262, 0.031879943, 0.09379751, 0.15517053,
    0.20020825, 0.21674114, 0.20020825, 0.15517053, 0.09379751, 0.031879943, -0.016186262,
    -0.04166761, -0.043577183, -0.028005365, -0.0051601734, 0.014624386, 0.024387382, 0.022352377,
    0.0116079, -0.0019397299, -0.012335026, -0.01590999, -0.012354134, -0.0042899773, 0.0042538098,
    0.009696761, 0.010292898, 0.006557314, 0.00070328976, -0.0045305756, -0.0070888256,
    -0.0063393954, -0.0031111876, 0.00087827817, 0.0038727189, 0.0048077558, 0.0036375371,
    0.0011865027, -0.0013345525, -0.0028912309, -0.0030198381, -0.0019181528, -0.00024770317,
    0.0012194271, 0.0019349628, 0.0017551293, 0.0009218459, -0.00010969268, -0.00089615857,
    -0.0011810855, -0.00095836946, -0.0004217047, 0.00015503204, 0.0005427991, 0.000636138,
    0.00046477153, 0.00014951751, -0.00016613922, -0.00037544663, -0.0004376953, -0.0003741896,
    -0.00024198946, -0.0001022896, 0.0000025561833, 0.00005722275, 0.000068608439, 0.000054528296,
    0.000032770109, 0.000014723354, 0.0000043782347,
];
const EXPECTED_NON_XT32_FLOAT_COUNTS = {
    XT: { speaker: 512, sub: 512 },
    MultEQ: { speaker: 128, sub: 512 },
};
const MEASUREMENT_CHANNEL_ORDER_FIXEDA = [
    "FL",
    "C",
    "FR",
    "FWR",
    "SRA",
    "SBR",
    "SBL",
    "SLA",
    "FWL",
    "CH",
    "FHR",
    "TFR",
    "FDR",
    "TMR",
    "TRR",
    "SHR",
    "RHR",
    "SDR",
    "BDR",
    "BDL",
    "SDL",
    "RHL",
    "SHL",
    "TRL",
    "TML",
    "FDL",
    "TFL",
    "FHL",
    "TS",
    "LFE",
    "SW1",
    "SW2",
    "SW3",
    "SW4",
];

const decomposeFilter = (filterTaps, M) => {
    const L = filterTaps.length;
    if (M <= 0 || L === 0) return Array.from({ length: M || 0 }, () => []);
    const phases = Array.from({ length: M }, () => []);
    for (let p = 0; p < M; p++) {
        for (let i = 0; ; i++) {
            const n = i * M + p;
            if (n >= L) break;
            phases[p].push(filterTaps[n]);
        }
    }
    return phases;
};
const polyphaseDecimate = (signal, phases, M, originalFilterLength) => {
    const signalLen = signal.length;
    const L = originalFilterLength;
    if (signalLen === 0 || L === 0 || M <= 0 || !phases || phases.length !== M) {
        return [];
    }
    const convolvedLength = signalLen + L - 1;
    const outputLen = Math.ceil(convolvedLength / M);
    if (outputLen <= 0) {
        return [];
    }
    const output = new Array(outputLen).fill(0.0);
    for (let k = 0; k < outputLen; k++) {
        let y_k = 0.0;
        for (let p = 0; p < M; p++) {
            const currentPhase = phases[p];
            for (let i = 0; i < currentPhase.length; i++) {
                const inIndex = k * M + p - i * M;
                if (inIndex >= 0 && inIndex < signalLen) {
                    y_k += currentPhase[i] * signal[inIndex];
                }
            }
        }
        output[k] = y_k;
    }
    return output;
};
const generateWindow = (len, type = 1) => {
    const c1 = [0.5];
    const c2 = [0.5];
    const c3 = [0.0];
    const typeIndex = type - 1;
    const a = typeIndex >= 0 && typeIndex < c1.length ? c1[typeIndex] : 0.5;
    const b = typeIndex >= 0 && typeIndex < c2.length ? c2[typeIndex] : 0.5;
    const c = typeIndex >= 0 && typeIndex < c3.length ? c3[typeIndex] : 0.0;
    if (len <= 0) return [];
    const window = new Array(len);
    const factor = 1.0 / (len > 1 ? len - 1 : 1);
    const pi2 = 2 * Math.PI;
    const pi4 = 4 * Math.PI;
    for (let i = 0; i < len; i++) {
        const t = i * factor;
        const cos2pit = Math.cos(pi2 * t);
        const cos4pit = Math.cos(pi4 * t);
        window[i] = a - b * cos2pit + c * cos4pit;
    }
    return window;
};
const calculateMultiSampleRateFilter = (currentResidual, bandIdx, config) => {
    const bandLen = config.bandLengths[bandIdx];
    const filterInfo = config.decFiltersInfo[bandIdx];
    const useDelayComp = config.delayComp[bandIdx];
    if (!filterInfo || !filterInfo.phases || !Array.isArray(filterInfo.phases)) {
        throw new Error(`Polyphase filter info missing or invalid for band ${bandIdx}.`);
    }
    const decFilterPhases = filterInfo.phases;
    const decFilterOriginalLen = filterInfo.originalLength;
    if (bandLen <= 0) {
        return { processedBand: [], updatedResidual: [...currentResidual] };
    }
    if (decFilterOriginalLen === 0) {
        throw new Error(
            `Decimation filter is empty (length 0) for non-zero length band ${bandIdx}. This should not happen.`
        );
    }
    const processedBand = new Array(bandLen).fill(0.0);
    const delay = useDelayComp ? Math.floor((decFilterOriginalLen * 3 - 3) / 2) : 0;
    const winLen = bandLen - delay;
    if (winLen < 0) {
        console.warn(
            `Calculated window length (${winLen}) is negative for band ${bandIdx} (BandLen: ${bandLen}, Delay: ${delay}). Clamping to 0.`
        );
        return { processedBand: [], updatedResidual: [...currentResidual] };
    }
    const winAlloc = winLen * 2 + 3;
    const fullWindow = generateWindow(winAlloc, 1);
    for (let i = 0; i < delay; i++) {
        if (i < currentResidual.length) {
            processedBand[i] = currentResidual[i];
        }
    }
    const windowOffset = Math.floor(winAlloc / 2) + 1;
    for (let i = 0; i < winLen; i++) {
        const residualIdx = delay + i;
        if (residualIdx < currentResidual.length && windowOffset + i < fullWindow.length) {
            processedBand[residualIdx] =
                currentResidual[residualIdx] * fullWindow[windowOffset + i];
        } else if (residualIdx >= currentResidual.length) {
            break;
        }
    }
    const residualForDecimation = [];
    for (let i = 0; i < winLen; i++) {
        const residualIdx = delay + i;
        if (residualIdx < currentResidual.length) {
            residualForDecimation.push(currentResidual[residualIdx] - processedBand[residualIdx]);
        } else {
            residualForDecimation.push(0.0);
        }
    }
    for (let i = delay + winLen; i < currentResidual.length; i++) {
        residualForDecimation.push(currentResidual[i]);
    }
    const decimatedResidual = polyphaseDecimate(
        residualForDecimation,
        decFilterPhases,
        DECIMATION_FACTOR,
        decFilterOriginalLen
    );
    const updatedResidual = decimatedResidual.map((v) => v * DECIMATION_FACTOR);
    return { processedBand, updatedResidual };
};
const calculateMultirate = (impulseResponse, config) => {
    if (!impulseResponse || impulseResponse.length === 0 || !config) {
        console.error("Invalid input to calculateMultirate.");
        return [];
    }
    const finalOutput = new Array(config.outputLength).fill(0.0);
    let currentResidual = [...impulseResponse];
    let outputWriteOffset = 0;
    const numBands = config.bandLengths.length;
    const bandsToProcess = numBands - 1;
    for (let bandIdx = 0; bandIdx < bandsToProcess; bandIdx++) {
        try {
            const { processedBand, updatedResidual } = calculateMultiSampleRateFilter(
                currentResidual,
                bandIdx,
                config
            );
            const currentBandLen = config.bandLengths[bandIdx];
            for (let i = 0; i < currentBandLen; i++) {
                const outputIdx = outputWriteOffset + i;
                if (outputIdx < finalOutput.length) {
                    finalOutput[outputIdx] = i < processedBand.length ? processedBand[i] : 0.0;
                } else {
                    console.warn(
                        `Output buffer overflow detected while writing band ${bandIdx}. Index ${outputIdx} >= Length ${finalOutput.length}.`
                    );
                    break;
                }
            }
            outputWriteOffset += currentBandLen;
            currentResidual = updatedResidual;
        } catch (error) {
            console.error(`Error processing band ${bandIdx}: ${error.message}`);
            throw new Error(
                `Failed during multi-sample rate processing for band ${bandIdx}: ${error.message}`
            );
        }
    }
    const lastBandIdx = numBands - 1;
    const lastBandLen = config.bandLengths[lastBandIdx];
    for (let i = 0; i < lastBandLen; i++) {
        const outputIdx = outputWriteOffset + i;
        if (outputIdx < finalOutput.length) {
            finalOutput[outputIdx] = i < currentResidual.length ? currentResidual[i] : 0.0;
        } else {
            console.warn(
                `Output buffer overflow detected while writing last band ${lastBandIdx}. Index ${outputIdx} >= Length ${finalOutput.length}.`
            );
            break;
        }
    }
    if (outputWriteOffset + lastBandLen > finalOutput.length) {
        console.warn(
            `Total length of written bands (${
                outputWriteOffset + Math.min(lastBandLen, currentResidual.length)
            }) potentially exceeds expected output length (${finalOutput.length}).`
        );
    } else if (outputWriteOffset + lastBandLen < finalOutput.length) {
    }
    return finalOutput;
};
function convertXT32(floats) {
    const inputLength = floats ? floats.length : 0;
    if (inputLength === 0) return [];
    let configToUse = null;
    let expectedOutputLength = 0;
    let type = "Unknown";
    if (inputLength === filterConfigs.xt32Speaker.inputLength) {
        configToUse = filterConfigs.xt32Speaker;
        expectedOutputLength = filterConfigs.xt32Speaker.outputLength;
        type = "Speaker";
    } else if (inputLength === filterConfigs.xt32Sub.inputLength) {
        configToUse = filterConfigs.xt32Sub;
        expectedOutputLength = filterConfigs.xt32Sub.outputLength;
        type = "Subwoofer";
    }
    if (configToUse) {
        try {
            const mangledFilter = calculateMultirate(floats, configToUse);
            if (mangledFilter.length !== expectedOutputLength) {
                console.warn(
                    `WARNING: XT32 (${type}) decimation output length (${mangledFilter.length}) does not match expected (${expectedOutputLength}). Input length was ${inputLength}. Padding or truncation might occur implicitly.`
                );
            }
            return mangledFilter;
        } catch (error) {
            console.error(
                `ERROR during XT32 calculateMultirate for ${inputLength} floats (${type}):`,
                error
            );
            console.warn(
                `Returning original filter due to decimation error. Length: ${floats.length}`
            );
            return [...floats];
        }
    } else {
        return [...floats];
    }
}
const filterConfigs = {
    xt32Sub: {
        description: "MultEQ XT32 Subwoofer",
        inputLength: 0x3eb7,
        outputLength: 0x2c0,
        bandLengths: [0x60, 0x60, 0x100, 0xef],
        decFiltersInfo: [
            {
                phases: decomposeFilter(decFilterXT32Sub29_taps, DECIMATION_FACTOR),
                originalLength: decFilterXT32Sub29_taps.length,
            },
            {
                phases: decomposeFilter(decFilterXT32Sub37_taps, DECIMATION_FACTOR),
                originalLength: decFilterXT32Sub37_taps.length,
            },
            {
                phases: decomposeFilter(decFilterXT32Sub93_taps, DECIMATION_FACTOR),
                originalLength: decFilterXT32Sub93_taps.length,
            },
        ],
        delayComp: [true, true, true],
    },
    xt32Speaker: {
        description: "MultEQ XT32 Speaker",
        inputLength: 0x3fc1,
        outputLength: 0x400,
        bandLengths: [0x100, 0x100, 0x100, 0xeb],
        decFiltersInfo: [
            {
                phases: decomposeFilter(decFilterXT32Sat129_taps, DECIMATION_FACTOR),
                originalLength: decFilterXT32Sat129_taps.length,
            },
            {
                phases: decomposeFilter(decFilterXT32Sat129_taps, DECIMATION_FACTOR),
                originalLength: decFilterXT32Sat129_taps.length,
            },
            {
                phases: decomposeFilter(decFilterXT32Sat129_taps, DECIMATION_FACTOR),
                originalLength: decFilterXT32Sat129_taps.length,
            },
        ],
        delayComp: [true, true, true],
    },
};
const channelByteTable = {
    FL: { eq2: 0x00, neq2: 0x00, griffin: 0x00 },
    C: { eq2: 0x01, neq2: 0x01, griffin: 0x01 },
    FR: { eq2: 0x02, neq2: 0x02, griffin: 0x02 },
    FWR: { eq2: 0x15, neq2: 0x15, griffin: 0x15 },
    SRA: { eq2: 0x03, neq2: 0x03, griffin: 0x03 },
    SRB: { eq2: null, neq2: 0x07, griffin: null },
    SBR: { eq2: 0x07, neq2: 0x07, griffin: 0x07 },
    SBL: { eq2: 0x08, neq2: 0x08, griffin: 0x08 },
    SLB: { eq2: null, neq2: 0x0d, griffin: null },
    SLA: { eq2: 0x0c, neq2: 0x0c, griffin: 0x0c },
    FWL: { eq2: 0x1c, neq2: 0x1c, griffin: 0x1c },
    FHL: { eq2: 0x10, neq2: 0x10, griffin: 0x10 },
    CH: { eq2: 0x12, neq2: 0x12, griffin: 0x12 },
    FHR: { eq2: 0x14, neq2: 0x14, griffin: 0x14 },
    TFR: { eq2: 0x04, neq2: 0x04, griffin: 0x04 },
    TMR: { eq2: 0x05, neq2: 0x05, griffin: 0x05 },
    TRR: { eq2: 0x06, neq2: 0x06, griffin: 0x06 },
    SHR: { eq2: 0x16, neq2: 0x16, griffin: 0x16 },
    RHR: { eq2: 0x13, neq2: 0x17, griffin: 0x13 },
    TS: { eq2: 0x1d, neq2: 0x1d, griffin: 0x1d },
    RHL: { eq2: 0x11, neq2: 0x1a, griffin: 0x11 },
    SHL: { eq2: 0x1b, neq2: 0x1b, griffin: 0x1b },
    TRL: { eq2: 0x09, neq2: 0x09, griffin: 0x09 },
    TML: { eq2: 0x0a, neq2: 0x0a, griffin: 0x0a },
    TFL: { eq2: 0x0b, neq2: 0x0b, griffin: 0x0b },
    FDL: { eq2: 0x1a, neq2: 0x1a, griffin: 0x1a },
    FDR: { eq2: 0x17, neq2: 0x17, griffin: 0x17 },
    SDR: { eq2: 0x18, neq2: 0x18, griffin: 0x18 },
    BDR: { eq2: 0x18, neq2: 0x00, griffin: 0x1f },
    SDL: { eq2: 0x19, neq2: 0x19, griffin: 0x19 },
    BDL: { eq2: 0x19, neq2: 0x00, griffin: 0x20 },
    SW1: { eq2: 0x0d, neq2: 0x0d, griffin: 0x0d },
    SW2: { eq2: 0x0e, neq2: 0x0e, griffin: 0x0e },
    SW3: { eq2: 0x21, neq2: 0x21, griffin: 0x21 },
    SW4: { eq2: 0x22, neq2: 0x22, griffin: 0x22 },
};
let cachedAvrConfig = null;
let mainServer = null;
function getBasePath() {
    if (process.pkg) {
        return path.dirname(process.execPath);
    } else {
        return __dirname;
    }
}
const APP_BASE_PATH = path.join(getBasePath(), "_calibrations");
const CONFIG_FILENAME = "receiver_config.avr";
const CONFIG_FILEPATH = path.join(APP_BASE_PATH, CONFIG_FILENAME);
const HTML_FILENAME = "A1Evo.html";
const HTML_FILEPATH = path.join(__dirname, HTML_FILENAME);
if (!fs.existsSync(HTML_FILEPATH)) {
    console.error(`[ERROR] HTML file check failed.`);
    console.error(`   Tried path: ${HTML_FILEPATH}`);
    console.error(`   APP_BASE_PATH (external): ${APP_BASE_PATH}`);
    console.error(`   __dirname (snapshot/script): ${__dirname}`);
    console.error(`   Is packaged (process.pkg): ${!!process.pkg}`);
    throw new Error(`Required file ${HTML_FILENAME} not found! Cannot start optimization.`);
}
console.log(`Base path for external files (like '.avr', '.oca', '.mdat'): ${APP_BASE_PATH}`);
console.log(`Attempting to load configuration from: ${CONFIG_FILEPATH}`);
class UPNPDiscovery {
    constructor(timeout = 5000) {
        this.socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
        this.SSDP_MULTICAST_ADDR = "239.255.255.250";
        this.SSDP_PORT = 1900;
        this.SEARCH_TARGETS = [
            "urn:schemas-denon-com:device:Receiver:1",
            "urn:schemas-upnp-org:device:MediaRenderer:1",
            "upnp:rootdevice",
            "ssdp:all",
        ];
        this.timeout = timeout;
        this.active = false;
    }
    _findLocalIp() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === "IPv4" && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return null;
    }
    discover() {
        return new Promise((resolve, reject) => {
            if (this.active) {
                return reject(new Error("Discovery is already in progress."));
            }
            this.active = true;
            const devices = new Map();
            const fetchPromises = [];
            let discoveryTimer;
            let localAddress = null;
            const finishDiscovery = () => {
                if (!this.active) return;
                this.active = false;
                clearTimeout(discoveryTimer);
                Promise.allSettled(fetchPromises).then(() => {
                    try {
                        if (this.socket && this.socket.address()) {
                            if (localAddress) {
                                try {
                                    this.socket.dropMembership(
                                        this.SSDP_MULTICAST_ADDR,
                                        localAddress
                                    );
                                } catch (e) {}
                            }
                            this.socket.close(() => {
                                resolve(Array.from(devices.values()));
                            });
                        } else {
                            resolve(Array.from(devices.values()));
                        }
                    } catch (closeError) {
                        console.error("Error closing discovery socket:", closeError);
                        resolve(Array.from(devices.values()));
                    }
                });
            };
            discoveryTimer = setTimeout(finishDiscovery, this.timeout);
            this.socket.on("error", (err) => {
                console.error(`Discovery socket error:\n${err.stack}`);
                if (!this.active) return;
                this.active = false;
                clearTimeout(discoveryTimer);
                try {
                    this.socket.close();
                } catch (e) {}
                reject(err);
            });
            this.socket.on("message", (msg, rinfo) => {
                if (!this.active) return;
                const response = msg.toString();
                if (
                    response.toUpperCase().startsWith("HTTP/1.1 200 OK") &&
                    response.toUpperCase().includes("LOCATION:")
                ) {
                    const locationMatch = response.match(/LOCATION:\s*(.+)/i);
                    const usnMatch = response.match(/USN:\s*(.+)/i);
                    const serverMatch = response.match(/SERVER:\s*(.+)/i);
                    if (locationMatch && locationMatch[1]) {
                        const locationUrl = locationMatch[1].trim();
                        if (!devices.has(locationUrl)) {
                            devices.set(locationUrl, {
                                address: rinfo.address,
                                descriptionUrl: locationUrl,
                                fetching: true,
                            });
                            const fetchPromise = this.fetchDeviceDescription(locationUrl)
                                .then((deviceInfo) => {
                                    if (
                                        deviceInfo.modelName &&
                                        deviceInfo.modelName !== "Unknown Model"
                                    ) {
                                        console.log(
                                            `-> Found device: ${deviceInfo.manufacturer} ${deviceInfo.modelName} at ${rinfo.address}`
                                        );
                                        devices.set(locationUrl, {
                                            address: rinfo.address,
                                            port: rinfo.port,
                                            usn: usnMatch ? usnMatch[1].trim() : null,
                                            server: serverMatch ? serverMatch[1].trim() : null,
                                            ...deviceInfo,
                                        });
                                    } else {
                                        devices.delete(locationUrl);
                                    }
                                })
                                .catch((err) => {
                                    console.error(
                                        `Error processing description for ${locationUrl}: ${err.message}`
                                    );
                                    devices.delete(locationUrl);
                                });
                            fetchPromises.push(fetchPromise);
                        }
                    }
                }
            });
            localAddress = this._findLocalIp();
            if (!localAddress) {
                console.error("No suitable IPv4 network interface found for discovery binding.");
                console.warn("Falling back to binding discovery socket to 0.0.0.0");
                localAddress = "0.0.0.0";
            }
            this.socket.bind(0, localAddress, () => {
                try {
                    this.socket.setBroadcast(true);
                    this.socket.setMulticastInterface(localAddress);
                    this.socket.addMembership(this.SSDP_MULTICAST_ADDR, localAddress);
                    console.log(
                        `Searching network for AV receivers via UPnP (Timeout: ${
                            this.timeout / 1000
                        }s)...`
                    );
                    this.SEARCH_TARGETS.forEach((target) => {
                        const searchRequest = Buffer.from(
                            "M-SEARCH * HTTP/1.1\r\n" +
                                `HOST: ${this.SSDP_MULTICAST_ADDR}:${this.SSDP_PORT}\r\n` +
                                'MAN: "ssdp:discover"\r\n' +
                                "MX: 2\r\n" +
                                `ST: ${target}\r\n\r\n`
                        );
                        this.socket.send(
                            searchRequest,
                            0,
                            searchRequest.length,
                            this.SSDP_PORT,
                            this.SSDP_MULTICAST_ADDR,
                            (err) => {
                                if (err) {
                                    console.error(
                                        `Error sending M-SEARCH for target ${target} via ${localAddress}: ${err}`
                                    );
                                }
                            }
                        );
                    });
                } catch (bindErr) {
                    console.error(
                        `Error setting up discovery socket options (bind/multicast) on ${localAddress}:`,
                        bindErr
                    );
                    if (this.active) {
                        this.active = false;
                        clearTimeout(discoveryTimer);
                        try {
                            this.socket.close();
                        } catch (e) {}
                        reject(bindErr);
                    }
                }
            });
        });
    }
    fetchDeviceDescription(locationUrl) {
        const requestTimeout = MAIN_CONFIG.timeouts.command || 5000;
        return new Promise((resolve, reject) => {
            let urlToFetch = locationUrl;
            const attemptFetch = (currentUrl) => {
                const parsedUrl = new URL(currentUrl);
                const options = {
                    hostname: parsedUrl.hostname,
                    port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: "GET",
                    timeout: requestTimeout,
                    headers: {
                        "User-Agent": "Node.js UPnP Discovery",
                        Accept: "text/xml, application/xml",
                    },
                };
                const protocol =
                    parsedUrl.protocol === "https:" ? require("https") : require("http");
                const req = protocol.request(options, (res) => {
                    let data = "";
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        res.resume();
                        const redirectUrl = new URL(res.headers.location, currentUrl).href;
                        attemptFetch(redirectUrl);
                        return;
                    }
                    if (res.statusCode !== 200) {
                        const errMsg = `Failed to get description ${currentUrl}. Status: ${res.statusCode} ${res.statusMessage}`;
                        console.warn(errMsg);
                        res.resume();
                        reject(new Error(errMsg));
                        return;
                    }
                    res.setEncoding("utf8");
                    res.on("data", (chunk) => (data += chunk));
                    res.on("end", () => {
                        parseStringPromise(data)
                            .then((parsed) => {
                                const device = parsed?.root?.device?.[0];
                                if (!device) {
                                    throw new Error(
                                        "Invalid device description XML structure (root.device missing)."
                                    );
                                }
                                resolve({
                                    modelName: device.modelName?.[0]?.trim() || "Unknown Model",
                                    manufacturer:
                                        device.manufacturer?.[0]?.trim() || "Unknown Manufacturer",
                                    friendlyName:
                                        device.friendlyName?.[0]?.trim() || "Unknown Device",
                                    descriptionUrl: locationUrl,
                                });
                            })
                            .catch((parseError) => {
                                console.error(
                                    `Error parsing device description XML from ${currentUrl}:`,
                                    parseError
                                );
                                console.error(
                                    "XML Data (first 500 chars):",
                                    data.substring(0, 500)
                                );
                                reject(new Error(`XML parse error: ${parseError.message}`));
                            });
                    });
                });
                req.on("error", (e) => {
                    const errMsg = `Error requesting description ${currentUrl}: ${e.message}`;
                    console.error(errMsg);
                    reject(new Error(errMsg));
                });
                req.on("timeout", () => {
                    req.destroy();
                    const errMsg = `Timeout requesting description ${currentUrl}`;
                    console.warn(errMsg);
                    reject(new Error(errMsg));
                });
                req.end();
            };
            attemptFetch(urlToFetch);
        });
    }
    static async interactiveDeviceSelection(devices) {
        if (!devices || devices.length === 0) {
            console.log("No devices provided for selection.");
            return null;
        }
        const choices = devices.map((device, index) => ({
            name: `[${index + 1}] ${
                device.friendlyName && !/unknown/i.test(device.friendlyName)
                    ? device.friendlyName
                    : device.modelName || "Unknown Model"
            } (${device.manufacturer || "Unknown Manuf."}) - ${device.address}`,
            value: index,
        }));
        choices.push(new inquirer.Separator());
        choices.push({ name: "Cancel / Enter IP Manually", value: -1 });
        const answers = await inquirer.prompt([
            {
                type: "list",
                name: "selectedDeviceIndex",
                message: "Multiple potential AVRs found via UPnP. Select the target device:",
                choices: choices,
                pageSize: Math.min(15, choices.length + 1),
            },
        ]);
        if (answers.selectedDeviceIndex === -1) {
            console.log("Device selection cancelled or user chose manual entry.");
            return null;
        }
        return devices[answers.selectedDeviceIndex];
    }
}
async function _connectToAVR(ip, port, timeout, purpose) {
    return new Promise((resolve, reject) => {
        const client = net.createConnection({ port, host: ip, timeout });
        let connectionTimeoutTimer;
        const cleanup = () => {
            clearTimeout(connectionTimeoutTimer);
            client.removeAllListeners("connect");
            client.removeAllListeners("error");
            client.removeAllListeners("timeout");
        };
        connectionTimeoutTimer = setTimeout(() => {
            console.error(
                `Connection to ${ip}:${port} for ${purpose} timed out after ${timeout}ms (manual timer).`
            );
            client.destroy();
            reject(new Error(`Connection timed out after ${timeout}ms (manual timer).`));
        }, timeout);
        client.once("connect", () => {
            cleanup();
            resolve(client);
        });
        client.once("error", (err) => {
            cleanup();
            console.error(
                `${
                    purpose.charAt(0).toUpperCase() + purpose.slice(1)
                } connection error to ${ip}:${port}: ${err.message} (Code: ${err.code})`
            );
            reject(new Error(`Connection error: ${err.message}`));
        });
        client.once("timeout", () => {
            cleanup();
            console.error(
                `${
                    purpose.charAt(0).toUpperCase() + purpose.slice(1)
                } connection to ${ip}:${port} timed out (net.socket timeout event).`
            );
            client.destroy();
            reject(new Error(`Connection timed out (socket event) after ${timeout}ms.`));
        });
    });
}
async function _sendRawAndParseJsonHelper(
    socket,
    hexWithChecksum,
    label,
    commandTimeout,
    bufferLimitBytes,
    errorContext = ""
) {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        const packet = Buffer.from(hexWithChecksum, "hex");
        let commandTimer;
        let isActive = true;
        const cleanup = (error = null) => {
            if (!isActive) return;
            isActive = false;
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            clearTimeout(commandTimer);
            if (error) {
                reject(error);
            }
        };
        const onData = (data) => {
            if (!isActive) return;
            buffer = Buffer.concat([buffer, data]);
            const utf8 = buffer.toString("utf8");
            const jsonStart = utf8.indexOf("{");
            const jsonEnd = utf8.lastIndexOf("}");
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const potentialJson = utf8.slice(jsonStart, jsonEnd + 1);
                try {
                    const parsed = JSON.parse(potentialJson);
                    cleanup();
                    resolve(parsed);
                } catch (err) {
                    if (buffer.length > bufferLimitBytes) {
                        cleanup(
                            new Error(
                                `[${label}] ${errorContext} Response buffer exceeded ${
                                    bufferLimitBytes / 1024
                                }KB without valid JSON.`
                            )
                        );
                    }
                }
            } else {
                if (buffer.length > bufferLimitBytes) {
                    cleanup(
                        new Error(
                            `[${label}] ${errorContext} Response buffer exceeded ${
                                bufferLimitBytes / 1024
                            }KB without JSON start/end markers.`
                        )
                    );
                }
            }
        };
        const onError = (err) => {
            console.error(`[${label}] Socket error during ${errorContext} command: ${err.message}`);
            cleanup(new Error(`Socket error during ${label} (${errorContext}): ${err.message}`));
        };
        commandTimer = setTimeout(() => {
            console.error(
                `[${label}] ${errorContext} Command timed out after ${commandTimeout}ms waiting for JSON response.`
            );
            cleanup(new Error(`[${label}] Timed out waiting for ${errorContext} JSON response.`));
        }, commandTimeout);
        socket.on("data", onData);
        socket.on("error", onError);
        socket.write(packet, (err) => {
            if (err) {
                console.error(`[${label}] Socket write error (${errorContext}): ${err.message}`);
                cleanup(new Error(`Write error during ${label} (${errorContext}): ${err.message}`));
            }
        });
    });
}
async function getAvrInfoAndStatusForConfig(socket, commandTimeout = MAIN_CONFIG.timeouts.command) {
    try {
        const infoJson = await _sendRawAndParseJsonHelper(
            socket,
            "54001300004745545f415652494e460000006c",
            "GET_AVRINF",
            commandTimeout,
            1 * 1024 * 1024,
            "Config"
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
        const statusJson = await _sendRawAndParseJsonHelper(
            socket,
            "54001300004745545f41565253545300000089",
            "GET_AVRSTS",
            commandTimeout,
            1 * 1024 * 1024,
            "Config"
        );
        let activeChannels = [];
        let rawChSetup = [];
        let ampAssignString = null;
        let assignBin = null;
        let eqTypeString = "";
        if (infoJson && infoJson.EQType) {
            eqTypeString = infoJson.EQType;
        }
        if (statusJson && statusJson.ChSetup && Array.isArray(statusJson.ChSetup)) {
            rawChSetup = statusJson.ChSetup;
            activeChannels = statusJson.ChSetup.filter(
                (entry) => entry && typeof entry === "object" && Object.values(entry)[0] !== "N"
            ).map((entry) => Object.keys(entry)[0]);
            console.log(`Detected Active Channels: ${activeChannels.join(", ") || "None"}`);
        } else {
            console.warn("Channel Setup data (ChSetup) missing or invalid in AVR status response.");
        }
        ampAssignString = statusJson?.AmpAssign;
        assignBin = statusJson?.AssignBin;
        if (!ampAssignString) console.warn("AmpAssign string missing from AVR status.");
        if (!assignBin) console.warn("AssignBin string (ampAssignInfo) missing from AVR status.");
        return {
            ip: socket.remoteAddress,
            rawChSetup,
            ampAssignString,
            assignBin,
            eqTypeString,
        };
    } catch (error) {
        console.error(`Failed to get necessary AVR status/info: ${error.message}`);
        throw new Error(`Failed during AVR status/info retrieval: ${error.message}`);
    }
}
function formatDataForFrontend(details) {
    if (!details) throw new Error("Cannot format data: Input details object is missing.");
    const targetModelName = details.modelName || "Unknown Model";
    const ipAddress = details.ip || null;
    const eqTypeString = details.eqTypeString || "";
    const ampAssignString = details.ampAssignString;
    const assignBin = details.assignBin;
    const rawChSetup = details.rawChSetup || [];
    let enMultEQType = null;
    if (typeof eqTypeString === "string" && eqTypeString) {
        if (eqTypeString.includes("XT32")) enMultEQType = 2;
        else if (eqTypeString.includes("XT")) enMultEQType = 1;
        else if (eqTypeString.includes("MultEQ")) enMultEQType = 0;
    }
    if (enMultEQType === null)
        console.warn(`Could not determine MultEQ Type from EQ string: "${eqTypeString}"!`);
    if (!ampAssignString) console.warn("Amp Assign string missing!");
    if (!assignBin) console.warn("Amp Assign Info (AssignBin) missing!");
    let detectedChannels = [];
    let subCount = 0;
    if (Array.isArray(rawChSetup)) {
        rawChSetup.forEach((entry) => {
            if (!entry || typeof entry !== "object") return;
            const commandId = Object.keys(entry)[0];
            const speakerType = entry[commandId];
            if (speakerType !== "N") {
                let standardizedId = commandId;
                if (commandId.startsWith("SWMIX")) standardizedId = commandId.replace("MIX", "");
                detectedChannels.push({ commandId: standardizedId });
                if (standardizedId.startsWith("SW") || standardizedId === "LFE") subCount++;
            }
        });
    } else {
        console.warn(
            "Channel Setup data missing or invalid. Cannot determine active channels or sub count!"
        );
    }
    if (detectedChannels.length === 0 && rawChSetup.length > 0) {
        console.warn("Channel Setup data was present, but no active channels were found!");
    } else if (detectedChannels.length === 0) {
        console.warn("No active channels detected!");
    }
    const simplifiedConfig = {
        targetModelName: targetModelName,
        ipAddress: ipAddress,
        enMultEQType: enMultEQType,
        subwooferNum: subCount,
        ampAssign: ampAssignString || null,
        ampAssignInfo: assignBin || null,
        detectedChannels: detectedChannels,
    };
    return simplifiedConfig;
}
async function fetchModelFromGoform(ipAddress) {
    const requestTimeout = MAIN_CONFIG.timeouts.command || 5000;
    return new Promise((resolve) => {
        const url = `http://${ipAddress}/goform/formMainZone_MainZoneXml.xml`;
        const options = {
            method: "GET",
            timeout: requestTimeout,
            headers: { "User-Agent": "Node.js Model Fetcher" },
        };
        const req = http.request(url, options, (res) => {
            let data = "";
            if (res.statusCode < 200 || res.statusCode >= 300) {
                if (res.statusCode !== 404) {
                    console.warn(
                        `Failed to get ${url}. Status: ${res.statusCode} ${res.statusMessage}!`
                    );
                }
                res.resume();
                resolve(null);
                return;
            }
            res.setEncoding("utf8");
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const modelMatch = data.match(
                        /<ModelName>\s*<value>(.*?)<\/value>\s*<\/ModelName>/i
                    );
                    const friendlyMatch = data.match(
                        /<FriendlyName>\s*<value>(.*?)<\/value>\s*<\/FriendlyName>/i
                    );
                    let modelName = modelMatch ? modelMatch[1].trim() : null;
                    const friendlyName = friendlyMatch ? friendlyMatch[1].trim() : null;
                    let finalName = modelName;
                    let source = modelName ? "ModelName tag" : "None";
                    const genericPatterns =
                        /receiver|network (audio|av)|(av|media) (server|renderer|player)/i;
                    if (!modelName || genericPatterns.test(modelName)) {
                        if (
                            friendlyName &&
                            friendlyName.length > 3 &&
                            !genericPatterns.test(friendlyName)
                        ) {
                            finalName = friendlyName;
                            source = "FriendlyName tag";
                        } else {
                            finalName = null;
                            source = "None Found";
                        }
                    }
                    if (finalName) {
                        console.log(
                            `Model name identified as "${finalName}" via /goform/ (${source}).`
                        );
                    } else {
                        console.log("Could not identify a specific model name via /goform/.");
                    }
                    resolve(finalName);
                } catch (parseError) {
                    console.error(`Error parsing XML from ${url}:`, parseError);
                    resolve(null);
                }
            });
        });
        req.on("error", (e) => {
            if (
                e.code === "ECONNREFUSED" ||
                e.code === "EHOSTUNREACH" ||
                e.code === "ENETUNREACH"
            ) {
            } else {
                console.error(`Error requesting ${url}: ${e.message} (Code: ${e.code})`);
            }
            resolve(null);
        });
        req.on("timeout", () => {
            req.destroy();
            console.error(`Timeout requesting ${url} after ${requestTimeout}ms`);
            resolve(null);
        });
        req.end();
    });
}
async function runFullDiscoveryAndSave(interactive = true) {
    let targetIp = null;
    let modelName = null;
    let manufacturer = null;
    let initialFriendlyName = null;
    let modelSource = "None";
    let selectedInitialInfo = null;
    try {
        const discovery = new UPNPDiscovery(MAIN_CONFIG.timeouts.discovery);
        let devices = await discovery.discover();
        console.log(
            `UPnP Discovery finished. Found ${devices.length} distinct device description(s).`
        );
        const potentialAvrs = devices.filter(
            (dev) =>
                dev.address &&
                ((dev.usn && /Receiver|AVR|Sound(_Sys|Bar)/i.test(dev.usn)) ||
                    /(Denon|Marantz)/i.test(dev.manufacturer || "") ||
                    (/AVR|Receiver|SR|NR|AV|Cinema|Sound(_Sys|Bar)|DigitalMediaAdapter/i.test(
                        dev.modelName || ""
                    ) &&
                        !/MediaRenderer|MediaServer|NetworkAudio|Speaker/i.test(
                            dev.modelName || ""
                        )) ||
                    (/AVR|Receiver|SR|NR|AV|Cinema|Sound(_Sys|Bar)|DigitalMediaAdapter/i.test(
                        dev.friendlyName || ""
                    ) &&
                        !/MediaRenderer|MediaServer|NetworkAudio|Speaker/i.test(
                            dev.friendlyName || ""
                        )))
        );
        console.log(`Filtered down to ${potentialAvrs.length} potential AVR description(s).`);
        const groupedByIp = potentialAvrs.reduce((acc, device) => {
            const ip = device.address;
            if (!acc[ip]) acc[ip] = [];
            acc[ip].push(device);
            return acc;
        }, {});
        const uniqueIPs = Object.keys(groupedByIp);
        console.log(
            `Found ${uniqueIPs.length} unique IP address(es) associated with potential AVRs.`
        );
        if (uniqueIPs.length === 1) {
            targetIp = uniqueIPs[0];
            const descriptionsForIp = groupedByIp[targetIp];
            selectedInitialInfo =
                descriptionsForIp.find(
                    (d) =>
                        d.modelName &&
                        !/Unknown|Generic|MediaRenderer|MediaServer/i.test(d.modelName)
                ) ||
                descriptionsForIp.find(
                    (d) =>
                        d.friendlyName &&
                        !/Unknown|Generic|MediaRenderer|MediaServer/i.test(d.friendlyName)
                ) ||
                descriptionsForIp[0];
            console.log(`Automatically selected single matching AVR at ${targetIp}`);
        } else if (uniqueIPs.length > 1 && interactive) {
            console.warn(`Multiple matching AVR IPs found via UPnP.`);
            const choicesForPrompt = uniqueIPs
                .map((ip) => {
                    const descriptions = groupedByIp[ip];
                    return (
                        descriptions.find(
                            (d) =>
                                d.modelName &&
                                !/Unknown|Generic|MediaRenderer|MediaServer/i.test(d.modelName)
                        ) ||
                        descriptions.find(
                            (d) =>
                                d.friendlyName &&
                                !/Unknown|Generic|MediaRenderer|MediaServer/i.test(d.friendlyName)
                        ) ||
                        descriptions[0]
                    );
                })
                .filter(Boolean);
            selectedInitialInfo = await UPNPDiscovery.interactiveDeviceSelection(choicesForPrompt);
            if (selectedInitialInfo) {
                targetIp = selectedInitialInfo.address;
                console.log(`User selected AVR at ${targetIp}`);
            } else {
                console.log("No device selected by user from UPnP list.");
            }
        } else if (uniqueIPs.length > 1 && !interactive) {
            console.error(
                "Automatic check failed: Multiple potential AVR IPs found via UPnP. Cannot auto-select."
            );
            return false;
        }
        if (selectedInitialInfo) {
            modelName = selectedInitialInfo.modelName;
            manufacturer = selectedInitialInfo.manufacturer;
            initialFriendlyName = selectedInitialInfo.friendlyName;
            if (modelName && !/Unknown Model|Generic|MediaRenderer|MediaServer/i.test(modelName)) {
                modelSource = "UPnP Description XML";
            } else {
                console.log(
                    `UPnP provided model name "${modelName}" is unreliable or missing. Will try other methods.`
                );
                modelName = null;
            }
        }
    } catch (discoveryError) {
        console.error(`Error during UPnP discovery phase: ${discoveryError.message}`);
    }
    if (!targetIp && interactive) {
        console.log(
            "\nUPnP discovery did not identify a target AVR IP, or selection was cancelled."
        );
        try {
            const ipAnswer = await inquirer.prompt([
                {
                    type: "input",
                    name: "manualIp",
                    message:
                        "Please enter your AV Receiver IP address (e.g., 192.168.1.100) manually (or leave blank to cancel):",
                    validate: (input) => {
                        if (input === "") return true;
                        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(input)
                            ? true
                            : "Please enter a valid IPv4 address or leave blank.";
                    },
                },
            ]);
            if (ipAnswer.manualIp) {
                targetIp = ipAnswer.manualIp.trim();
                console.log(`Using manually entered IP: ${targetIp}`);
                modelName = null;
                manufacturer = null;
                initialFriendlyName = null;
                modelSource = "Manual IP (Model Unknown)";
                selectedInitialInfo = { address: targetIp };
            } else {
                console.log("Manual IP entry cancelled.");
            }
        } catch (promptError) {
            console.error("Error during manual IP prompt:", promptError);
            return false;
        }
    }
    if (!targetIp) {
        console.error("Configuration aborted: No target IP address could be determined.");
        return false;
    }
    if (modelSource !== "UPnP Description XML" || !modelName) {
        console.log(
            `\nAttempting to verify/find model name via /goform/ endpoint on ${targetIp}...`
        );
        const goformModel = await fetchModelFromGoform(targetIp);
        if (goformModel) {
            if (!modelName) {
                modelName = goformModel;
                modelSource = "/goform/ XML";
            } else {
                const upnpLower = modelName.toLowerCase();
                const goformLower = goformModel.toLowerCase();
                if (upnpLower === goformLower) {
                    console.log(`Model name "${modelName}" confirmed via /goform/.`);
                    modelSource = "/goform/ XML (Confirmed UPnP)";
                } else {
                    console.warn(
                        `Model name discrepancy: UPnP reported "${modelName}", /goform/ reports "${goformModel}".`
                    );
                    const modelOnlyUPnP = modelName.split(" ").pop();
                    const modelOnlyGoform = goformModel.split(" ").pop();
                    if (
                        modelOnlyUPnP &&
                        modelOnlyGoform &&
                        modelOnlyUPnP.toLowerCase() === modelOnlyGoform.toLowerCase()
                    ) {
                        console.log(
                            `   -> Core model parts match ("${modelOnlyUPnP}"). Preferring the more complete /goform/ version: "${goformModel}".`
                        );
                        modelName = goformModel;
                        modelSource = "/goform/ XML (Discrepancy, Core Match)";
                    } else if (interactive) {
                        const confirmGoform = await inquirer.prompt([
                            {
                                type: "confirm",
                                name: "useGoform",
                                message: `UPnP reported "${modelName}" but /goform/ reports "${goformModel}". They seem different. Use the /goform/ version ("${goformModel}")?`,
                                default: true,
                            },
                        ]);
                        if (confirmGoform.useGoform) {
                            modelName = goformModel;
                            modelSource = "/goform/ XML (User Confirmed Discrepancy)";
                        } else {
                            modelSource += " (User Rejected /goform/ Version)";
                        }
                    } else {
                        console.log(
                            `   Non-interactive mode: Discrepancy detected. Preferring /goform/ version "${goformModel}".`
                        );
                        modelName = goformModel;
                        modelSource = "/goform/ XML (Auto-selected on Discrepancy)";
                    }
                }
            }
        } else {
            console.log("Could not get a valid model name from /goform/ endpoint.");
            if (!modelName) modelSource = "None Found";
        }
    }
    let finalModelName = modelName;
    if (interactive) {
        let promptForModel = false;
        if (
            finalModelName &&
            finalModelName !== "Unknown Model" &&
            !/Generic|MediaRenderer|MediaServer/i.test(finalModelName)
        ) {
            const confirm = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "isCorrect",
                    message: `Is "${finalModelName}" the correct model for the device at ${targetIp}? (Source: ${modelSource})`,
                    default: true,
                },
            ]);
            if (!confirm.isCorrect) {
                finalModelName = null;
                promptForModel = true;
            }
        } else {
            console.log("\nCould not automatically determine or confirm the AVR model name.");
            promptForModel = true;
        }
        if (promptForModel) {
            const modelPrompt = await inquirer.prompt([
                {
                    type: "input",
                    name: "modelNameManual",
                    message:
                        "Please enter the correct AVR Model Name e.g., SR6011, X3800H (last 6 digits are evaluated):",
                    validate: (input) =>
                        input && input.trim().length > 1 ? true : "Model name cannot be empty.",
                },
            ]);
            finalModelName = modelPrompt.modelNameManual.trim();
            modelSource = "Manual Entry (User Provided)";
        }
    } else {
        if (
            !finalModelName ||
            finalModelName === "Unknown Model" ||
            /Generic|MediaRenderer|MediaServer/i.test(finalModelName)
        ) {
            console.error(
                `Automatic check failed: Could not determine a valid AVR Model Name for ${targetIp}. (Last attempt source: ${modelSource})`
            );
            return false;
        }
        console.log(
            `Using automatically determined model name: "${finalModelName}" (Source: ${modelSource})`
        );
    }
    if (!finalModelName) {
        console.error("Configuration aborted: Final Model Name could not be determined.");
        return false;
    }
    let socket = null;
    let avrOperationalData = null;
    try {
        socket = await _connectToAVR(
            targetIp,
            AVR_CONTROL_PORT,
            MAIN_CONFIG.timeouts.connection,
            "config"
        );
        avrOperationalData = await getAvrInfoAndStatusForConfig(
            socket,
            MAIN_CONFIG.timeouts.command
        );
    } catch (err) {
        console.error(`Error during connection or status fetch for ${targetIp}: ${err.message}`);
        if (socket && !socket.destroyed) {
            socket.destroy();
        }
        return false;
    } finally {
        if (socket && !socket.destroyed) {
            socket.end(() => {});
            await new Promise((resolve) => setTimeout(resolve, 50));
            if (socket && !socket.destroyed) socket.destroy();
        }
    }
    try {
        const finalDetails = {
            ip: avrOperationalData.ip,
            rawChSetup: avrOperationalData.rawChSetup,
            ampAssignString: avrOperationalData.ampAssignString,
            assignBin: avrOperationalData.assignBin,
            eqTypeString: avrOperationalData.eqTypeString,
            modelName: finalModelName,
            manufacturer: manufacturer || "",
            friendlyName: initialFriendlyName || "",
        };
        const frontendData = formatDataForFrontend(finalDetails);
        fs.writeFileSync(CONFIG_FILEPATH, JSON.stringify(frontendData, null, 2));
        //console.log('Configuration saved successfully.');
        cachedAvrConfig = frontendData;
        return true;
    } catch (formatSaveError) {
        console.error(`Error formatting or saving configuration: ${formatSaveError.message}`);
        return false;
    }
}
function loadConfigFromFile() {
    if (fs.existsSync(CONFIG_FILEPATH)) {
        try {
            const fileContent = fs.readFileSync(CONFIG_FILEPATH, "utf-8");
            const parsedConfig = JSON.parse(fileContent);
            if (!parsedConfig.ipAddress || !parsedConfig.targetModelName) {
                console.warn(
                    `Warning: Loaded config from ${CONFIG_FILENAME} seems incomplete (missing IP or Model Name). Consider re-running configuration.`
                );
                cachedAvrConfig = parsedConfig;
                return true;
            } else {
                console.log(
                    `Configuration loaded for: ${parsedConfig.targetModelName} at ${parsedConfig.ipAddress}`
                );
                cachedAvrConfig = parsedConfig;
                return true;
            }
        } catch (error) {
            console.error(`Error reading or parsing ${CONFIG_FILENAME}: ${error.message}`);
            cachedAvrConfig = null;
            return false;
        }
    } else {
        cachedAvrConfig = null;
        return false;
    }
}
async function mainMenu() {
    const configExistsAndValid =
        loadConfigFromFile() && cachedAvrConfig && cachedAvrConfig.ipAddress;
    const configOptionName = cachedAvrConfig
        ? "1. Recreate AVR Configuration File (Overwrite Existing)"
        : "1. Discover AVR & Create Configuration File";
    const optimizeDisabled = !configExistsAndValid;
    const transferDisabled = !configExistsAndValid;
    const measureDisabled = !configExistsAndValid;
    const choices = [
        { name: configOptionName, value: "config" },
        {
            name: "2. Measure System Speakers & Subwoofers",
            value: "measure",
            disabled: measureDisabled ? "Requires valid configuration file" : false,
        },
        {
            name: "3. Start Optimizer (opens 'A1 Evo' in your browser)",
            value: "optimize",
            disabled: optimizeDisabled ? "Requires valid configuration file" : false,
        },
        {
            name: "4. Transfer Optimized Calibration (.oca File) to your AVR",
            value: "transfer",
            disabled: transferDisabled ? "Requires valid configuration file" : false,
        },
        new inquirer.Separator(),
        { name: "Exit", value: "exit" },
    ];
    try {
        const answers = await inquirer.prompt([
            {
                type: "list",
                name: "action",
                message: "Choose an action:",
                choices: choices,
                loop: false,
            },
        ]);
        switch (answers.action) {
            case "config":
                const success = await runFullDiscoveryAndSave(true);
                if (success) {
                    console.log(`AVR configuration file 'receiver_config.avr' saved successfully.`);
                } else {
                    console.error("AVR configuration process failed or was cancelled.");
                }
                await mainMenu();
                break;
            case "optimize":
                if (!cachedAvrConfig || !cachedAvrConfig.ipAddress) {
                    console.error(
                        `\nError: Cannot start optimization. Configuration file: '${CONFIG_FILENAME}' is missing or invalid.`
                    );
                    console.warn("Please run Option 1 first.");
                    await mainMenu();
                    break;
                }
                if (!fs.existsSync(HTML_FILEPATH)) {
                    console.error(
                        `\nError: Required file ${HTML_FILENAME} not found at ${HTML_FILEPATH}! Cannot start optimization.`
                    );
                    await mainMenu();
                    break;
                }
                const rewReady = await ensureRewReady();
                if (!rewReady) {
                    console.warn(
                        "\nREW check failed or user chose not to proceed. Aborting optimization."
                    );
                    await mainMenu();
                    break;
                }
                const optimizationUrl = `http://localhost:${SERVER_PORT}/`;
                try {
                    console.log(`Opening ${optimizationUrl} in your default web browser...`);
                    await open(optimizationUrl, { wait: false });
                    console.log("\nA1 Evo should now be open in your browser.");
                    console.log("Complete the optimization steps there.");
                    console.log(
                        "You can return here to transfer calibration or exit when finished."
                    );
                    console.log(
                        "=================================================================="
                    );
                } catch (error) {
                    console.error(`\nError opening browser: ${error.message}`);
                    console.error(`Please manually open your browser to: ${optimizationUrl}`);
                } finally {
                    await mainMenu();
                }
                break;
            case "transfer":
                if (!cachedAvrConfig || !cachedAvrConfig.ipAddress) {
                    console.error(
                        `\nError: Cannot transfer calibration. Configuration (${CONFIG_FILENAME}) is missing or invalid.`
                    );
                    console.warn("Please run Option 1 first.");
                    await mainMenu();
                    break;
                }
                try {
                    const targetIp = cachedAvrConfig.ipAddress;
                    await runCalibrationTransfer(targetIp, APP_BASE_PATH);
                    console.log("--------------------------------------");
                    console.log("Calibration transfer process completed.");
                    console.log("--------------------------------------");
                } catch (error) {
                    console.error(
                        `\n[Main Menu] Error during calibration transfer: ${error.message}`
                    );
                } finally {
                    await mainMenu();
                }
                break;
            case "measure":
                if (!cachedAvrConfig || !cachedAvrConfig.ipAddress) {
                    console.error(
                        `\nError: Cannot start measurement. Configuration (${CONFIG_FILENAME}) is missing or invalid.`
                    );
                    console.warn("Please run Option 1 first.");
                    await mainMenu();
                    break;
                }
                try {
                    await runMeasurementProcess();
                    console.log("-----------------------------------");
                    console.log("System measurement process completed.");
                    console.log("-----------------------------------");
                } catch (error) {
                    console.error(
                        `\n[Main Menu] Error during measurement process: ${error.message}`
                    );
                } finally {
                    await mainMenu();
                }
                break;
            case "exit":
                console.log("\nExiting application...");
                if (mainServer) {
                    mainServer.close(() => {
                        process.exit(0);
                    });
                    setTimeout(() => {
                        console.warn("Server close timed out. Forcing exit.");
                        process.exit(1);
                    }, 2000);
                } else {
                    process.exit(0);
                }
                break;
            default:
                console.log("Invalid choice. Please try again.");
                await mainMenu();
                break;
        }
    } catch (promptError) {
        console.error("\nError during menu interaction:", promptError);
        if (mainServer) mainServer.close();
        process.exit(1);
    }
}
async function initializeApp() {
    console.log("---------------------------");
    console.log("  A1 Evo Acoustica by OCA");
    console.log("---------------------------");
    mainServer = http.createServer((req, res) => {
        const requestUrl = new URL(req.url, `http://${req.headers.host}`);
        const pathname = requestUrl.pathname;
        const method = req.method;
        try {
            if (method === "POST" && pathname === "/api/save-oca") {
                let body = "";
                req.on("data", (chunk) => {
                    body += chunk.toString();
                });
                req.on("end", async () => {
                    let safeOcaFilename = "unknown_error.oca";
                    let safeLogFilename = "unknown_error_log.html";
                    try {
                        const requestPayload = JSON.parse(body);
                        const ocaData = requestPayload.ocaData;
                        const receivedOcaFilename = requestPayload.filename;
                        const logHtml = requestPayload.logHtml;
                        if (
                            !ocaData ||
                            typeof ocaData !== "object" ||
                            !ocaData.channels ||
                            !receivedOcaFilename ||
                            typeof receivedOcaFilename !== "string" ||
                            typeof logHtml !== "string"
                        ) {
                            throw new Error(
                                "Invalid payload received. Missing ocaData, filename, or logHtml."
                            );
                        }
                        if (!receivedOcaFilename.toLowerCase().endsWith(".oca")) {
                            throw new Error("Invalid OCA filename received. Must end with .oca");
                        }
                        safeOcaFilename = path.basename(
                            receivedOcaFilename.replace(/[\/\\]/g, "_")
                        );
                        const ocaParsedPath = path.parse(safeOcaFilename);
                        safeLogFilename = `${ocaParsedPath.name}.html`;
                        const ocaFilepath = path.join(APP_BASE_PATH, safeOcaFilename);
                        const logFilepath = path.join(APP_BASE_PATH, safeLogFilename);
                        const ocaJsonData = JSON.stringify(ocaData, null, 2);
                        await Promise.all([
                            fsPromises.writeFile(ocaFilepath, ocaJsonData, "utf8"),
                            fsPromises.writeFile(logFilepath, logHtml, "utf8"),
                        ]);
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(
                            JSON.stringify({
                                success: true,
                                message: "Calibration and log saved successfully.",
                                ocaFilename: safeOcaFilename,
                                logFilename: safeLogFilename,
                            })
                        );
                    } catch (error) {
                        console.error(
                            `[Server] Error processing /api/save-oca request: ${error.message}`
                        );
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(
                            JSON.stringify({
                                success: false,
                                message: `Error saving files on server. Check permissions for ${APP_BASE_PATH}.`,
                                error: error.message,
                                errorDetails: {
                                    ocaFile: safeOcaFilename,
                                    logFile: safeLogFilename,
                                },
                            })
                        );
                    }
                });
                req.on("error", (err) => {
                    console.error("[Server] Request stream error for /api/save-oca:", err);
                    if (!res.headersSent) {
                        res.writeHead(500, { "Content-Type": "application/json" });
                        res.end(
                            JSON.stringify({ success: false, message: "Server request error." })
                        );
                    }
                });
            } else if (method === "GET" && (pathname === "/" || pathname === `/${HTML_FILENAME}`)) {
                fs.readFile(HTML_FILEPATH, (err, data) => {
                    if (err) {
                        console.error(`[Server] Error reading ${HTML_FILENAME}:`, err);
                        res.writeHead(500, { "Content-Type": "text/plain" });
                        res.end("Internal Server Error: Could not load main HTML file.");
                    } else {
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(data);
                    }
                });
            } else if (method === "GET" && pathname === "/webWorker.js") {
                const workerScriptPath = path.join(__dirname, "webWorker.js");
                fs.readFile(workerScriptPath, (err, data) => {
                    if (err) {
                        console.error(`[Server] Error reading webWorker.js:`, err);
                        res.writeHead(500, { "Content-Type": "text/plain" });
                        res.end("Internal Server Error: Could not load worker script.");
                    } else {
                        res.writeHead(200, { "Content-Type": "application/javascript" });
                        res.end(data);
                    }
                });
            } else if (method === "GET" && pathname === `/${CONFIG_FILENAME}`) {
                if (cachedAvrConfig && cachedAvrConfig.ipAddress) {
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(cachedAvrConfig));
                } else {
                    fs.readFile(CONFIG_FILEPATH, (err, data) => {
                        if (err) {
                            console.warn(
                                `[Server] ${CONFIG_FILENAME} requested but not found or not cached.`
                            );
                            res.writeHead(404, { "Content-Type": "application/json" });
                            res.end(
                                JSON.stringify({
                                    error: `${CONFIG_FILENAME} not found. Run configuration first.`,
                                })
                            );
                        } else {
                            try {
                                const fileConfig = JSON.parse(data.toString());
                                res.writeHead(200, { "Content-Type": "application/json" });
                                res.end(data);
                            } catch (parseErr) {
                                console.error(
                                    `[Server] Error parsing ${CONFIG_FILENAME} from disk:`,
                                    parseErr
                                );
                                res.writeHead(500, { "Content-Type": "application/json" });
                                res.end(
                                    JSON.stringify({ error: `Error reading configuration file.` })
                                );
                            }
                        }
                    });
                }
            } else if (method === "GET" && pathname === "/api/get-app-path") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ appPath: APP_BASE_PATH }));
            } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Not Found");
            }
        } catch (serverError) {
            console.error("[Server] Unhandled error during request processing:", serverError);
            try {
                if (!res.headersSent) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("Internal Server Error");
                }
            } catch (responseError) {
                console.error("[Server] Error sending 500 response:", responseError);
            }
        }
    });
    mainServer.listen(SERVER_PORT, "127.0.0.1", () => {
        mainMenu();
    });
    mainServer.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\nFATAL ERROR: Port ${SERVER_PORT} is already in use.`);
            console.error(
                "Please close the application using the port (maybe another instance of this app?)"
            );
            console.error(
                "Or, if necessary, change SERVER_PORT constant at the top of the script."
            );
        } else {
            console.error("\nFATAL SERVER ERROR:", err);
        }
        process.exit(1);
    });
}
function isProcessRunning(processName) {
    return new Promise((resolve) => {
        const platform = os.platform();
        let cmd = "";
        const lowerCaseProc = processName.toLowerCase();
        if (platform === "win32") {
            cmd = `tasklist /FI "IMAGENAME eq ${processName}" /NH`;
        } else {
            const escapedName = processName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            cmd = `pgrep -fl "${escapedName}"`;
        }
        exec(cmd, (error, stdout, stderr) => {
            if (platform === "win32") {
                resolve(stdout.toLowerCase().includes(lowerCaseProc));
            } else {
                if (error) {
                    resolve(false);
                } else {
                    resolve(stdout.trim().length > 0);
                }
            }
        });
    });
}
function findRewPath() {
    const platform = os.platform();
    const commonPaths = [];
    if (platform === "win32") {
        const progFiles = process.env["ProgramFiles"] || "C:\\Program Files";
        const progFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
        commonPaths.push(path.join(progFiles, "REW", "roomeqwizard.exe"));
        commonPaths.push(path.join(progFilesX86, "REW", "roomeqwizard.exe"));
        commonPaths.push(path.join(progFiles, "Room EQ Wizard", "roomeqwizard.exe"));
        commonPaths.push(path.join(progFilesX86, "Room EQ Wizard", "roomeqwizard.exe"));
    } else if (platform === "darwin") {
        commonPaths.push("/Applications/REW.app/Contents/MacOS/roomeqwizard");
        commonPaths.push("/Applications/REW.app");
        commonPaths.push("/Applications/REW/REW.app/Contents/MacOS/JavaApplicationStub");
        commonPaths.push("/Applications/REW/REW.app");
        const home = os.homedir();
        commonPaths.push(path.join(home, "Applications/REW.app/Contents/MacOS/roomeqwizard"));
        commonPaths.push(path.join(home, "Applications/REW.app"));
        commonPaths.push(path.join("Applications/REW/REW.app/Contents/MacOS/JavaApplicationStub"));
        commonPaths.push(path.join(home, "Applications/REW/REW.app"));
    } else {
        console.warn(
            "Automatic REW path detection on Linux/Unix is limited. Assuming 'roomeqwizard' is in PATH."
        );
        return "roomeqwizard";
    }
    console.log("Checking common REW installation paths...");
    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            if (platform === "darwin") {
                if (p.endsWith(".app")) {
                    console.log(`Found REW application bundle: ${p}`);
                    return p;
                } else if (p.includes("/Contents/MacOS/")) {
                    const appPath = p.slice(0, p.indexOf("/Contents/MacOS/"));
                    console.log(`Found REW binary, using corresponding bundle: ${appPath}`);
                    return appPath;
                } else {
                    console.log(`Found REW directly: ${p}`);
                    return p;
                }
            } else {
                console.log(`Found REW: ${p}`);
                return p;
            }
        }
    }
    if (platform === "win32" || platform === "darwin") {
        console.log("REW not found in standard locations.");
        return null;
    }
    return "roomeqwizard";
}
function launchRew(rewPath, memoryArg = "-Xmx4096m") {
    return new Promise((resolve) => {
        const platform = os.platform();
        let cmd = "";
        let args = [];
        const apiArg = "-api";
        console.log(`Launching REW with ~4GB allocated memory and starting its API server...`);
        try {
            if (platform === "win32") {
                cmd = "start";
                args = ['"REW"', `"${rewPath}"`, memoryArg, apiArg];
                const child = spawn(cmd, args, { detached: true, stdio: "ignore", shell: true });
                child.on("error", (err) => {
                    console.error(`Error launching REW (Win32 using start): ${err.message}`);
                    resolve(false);
                });
                child.unref();
                resolve(true);
            } else if (platform === "darwin") {
                if (rewPath.endsWith(".app")) {
                    cmd = "open";
                    args = ["-a", rewPath, "--args", memoryArg, apiArg];
                } else {
                    cmd = rewPath;
                    args = [memoryArg, apiArg];
                }
                const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
                child.on("error", (err) => {
                    console.error(`Error launching REW (macOS using ${cmd}): ${err.message}`);
                    resolve(false);
                });
                child.unref();
                resolve(true);
            } else {
                cmd = rewPath;
                args = [memoryArg, apiArg];
                const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
                child.on("error", (err) => {
                    console.error(`Error launching REW (Linux/Other): ${err.message}`);
                    if (err.code === "ENOENT") {
                        console.error(
                            `Hint: Ensure '${rewPath}' is executable and in your system's PATH or provide the full path.`
                        );
                    }
                    resolve(false);
                });
                child.unref();
                resolve(true);
            }
        } catch (err) {
            console.error(`Exception trying to launch REW: ${err.message}`);
            resolve(false);
        }
    });
}
function checkRewApi(port = rewApiPort, timeout = 2000) {
    return new Promise((resolve) => {
        const options = {
            hostname: "127.0.0.1",
            port: port,
            path: "/version",
            method: "GET",
            timeout: timeout,
        };
        const req = http.request(options, (res) => {
            let responseBody = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => {
                responseBody += chunk;
            });
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve(true);
                } else {
                    console.warn(
                        `[checkRewApi] Failed: Received status code ${res.statusCode}. Body: ${responseBody}`
                    );
                    resolve(false);
                }
            });
        });
        req.on("error", (err) => {
            if (err.code === "ECONNREFUSED") {
            } else {
                console.warn(
                    `[checkRewApi] Failed: Network error - ${err.message} (Code: ${err.code})`
                );
            }
            resolve(false);
        });
        req.on("timeout", () => {
            console.warn(`[checkRewApi] Failed: Request timed out after ${timeout}ms.`);
            req.destroy();
            resolve(false);
        });
        req.end();
    });
}
async function ensureRewReady() {
    const platform = os.platform();
    const procNameExe = "roomeqwizard.exe";
    const procNameApp = "REW.app";
    const procNameJava = "java";
    let isRunning = false;
    if (platform === "win32") {
        isRunning = await isProcessRunning(procNameExe);
    } else if (platform === "darwin") {
        isRunning =
            (await isProcessRunning("REW")) ||
            (await isProcessRunning("roomeqwizard")) ||
            (await isProcessRunning("java.*roomeqwizard"));
    } else {
        isRunning =
            (await isProcessRunning("roomeqwizard")) ||
            (await isProcessRunning("java.*roomeqwizard"));
    }
    let isApiListening = false;
    if (isRunning) isApiListening = await checkRewApi(rewApiPort);
    if (isRunning && isApiListening) {
        console.log("REW is running and its API server is active. Good to go!");
        return true;
    }
    if (isRunning && !isApiListening) {
        console.warn(
            `Room EQ Wizard is open, but the API on port ${rewApiPort} did not respond correctly.`
        );
        console.warn(
            "Possible reasons: REW is still starting up, API server is disabled (needs '-api' launch flag or setting in Prefs->API), firewall blocking, or different API port configured in REW."
        );
        const { proceedAnyway } = await inquirer.prompt([
            {
                type: "confirm",
                name: "proceedAnyway",
                message: `REW seems running, but the API isn't ready. Continue to open A1 Evo anyway? (May not function correctly without REW API)`,
                default: false,
            },
        ]);
        return proceedAnyway;
    }
    console.log("Room EQ Wizard (REW) is not running!");
    const rewPath = findRewPath();
    if (!rewPath) {
        console.error("Could not automatically find REW installation in common locations.");
        console.log(`Please start REW manually.`);
        console.log(
            "IMPORTANT: Ensure REW's API server is started (Preferences -> API -> Strat API server)."
        );
        const { proceedManual } = await inquirer.prompt([
            {
                type: "confirm",
                name: "proceedManual",
                message: `Could not find REW automatically. Please start it manually (with API enabled).\nProceed to open A1 Evo once REW is ready?`,
                default: true,
            },
        ]);
        return proceedManual;
    }
    const { launchChoice } = await inquirer.prompt([
        {
            type: "confirm",
            name: "launchChoice",
            message: `Found REW at "${rewPath}". Attempt to launch it now with the API enabled?`,
            default: true,
        },
    ]);
    if (!launchChoice) {
        console.log(
            "User chose not to launch REW automatically. Please start it manually with the API enabled."
        );
        const { proceedAfterManual } = await inquirer.prompt([
            {
                type: "confirm",
                name: "proceedAfterManual",
                message: `Proceed to open A1 Evo once you believe REW is ready?`,
                default: true,
            },
        ]);
        return proceedAfterManual;
    }
    const memoryArg = "-Xmx4096m";
    const launchInitiated = await launchRew(rewPath, memoryArg);
    if (!launchInitiated) {
        console.error("Failed to execute the REW launch command.");
        console.log("Please try starting REW manually with the API enabled.");
        const { proceedError } = await inquirer.prompt([
            {
                type: "confirm",
                name: "proceedError",
                message: `Failed to start REW automatically. Please start it manually (with API enabled).\nProceed to open A1 Evo once REW is ready?`,
                default: true,
            },
        ]);
        return proceedError;
    }
    const waitTime = 15000;
    console.log(`Waiting ${waitTime / 1000} seconds for REW and its API server to initialize...`);
    await delay(waitTime);
    const isApiListeningAfterLaunch = await checkRewApi(rewApiPort);
    if (isApiListeningAfterLaunch) {
        console.log("REW launched and API server responded successfully. Proceeding...");
        return true;
    } else {
        console.error(
            `Launched REW, but the API on port ${rewApiPort} did not respond correctly within the wait time.`
        );
        console.warn(
            "Check REW preferences (API enabled?), firewall settings, or if REW failed to start properly."
        );
        const { proceedFail } = await inquirer.prompt([
            {
                type: "confirm",
                name: "proceedFail",
                message: `Started REW, but couldn't confirm API status on port ${rewApiPort}.\nContinue to open A1 Evo anyway? (May not function correctly)`,
                default: false,
            },
        ]);
        return proceedFail;
    }
}
process.on("SIGINT", () => {
    console.log("\nCtrl+C detected. Shutting down...");
    if (mainServer) {
        mainServer.close(() => {
            console.log("Server closed.");
            process.exit(0);
        });
        setTimeout(() => {
            console.warn("Server close timed out. Forcing exit.");
            process.exit(1);
        }, 2000);
    } else {
        process.exit(0);
    }
});
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function getAvrInfoAndStatusForTransfer(socket) {
    const commandTimeout = TRANSFER_CONFIG.timeouts.command;
    try {
        const infoJson = await _sendRawAndParseJsonHelper(
            socket,
            "54001300004745545f415652494e460000006c",
            "GET_AVRINF",
            commandTimeout,
            8 * 1024,
            "Transfer"
        );
        const statusJson = await _sendRawAndParseJsonHelper(
            socket,
            "54001300004745545f41565253545300000089",
            "GET_AVRSTS",
            commandTimeout,
            8 * 1024,
            "Transfer"
        );
        const reportedDType = infoJson?.DType;
        const coefWait = infoJson?.CoefWaitTime;
        let activeChannels = [];
        let rawChSetup = [];
        if (statusJson?.ChSetup && Array.isArray(statusJson.ChSetup)) {
            rawChSetup = statusJson.ChSetup;
            activeChannels = statusJson.ChSetup.filter(
                (entry) => entry && typeof entry === "object" && Object.values(entry)[0] !== "N"
            ).map((entry) => Object.keys(entry)[0]);
        } else {
            throw new Error(
                "ChSetup is missing or invalid in AVR status response. Cannot construct SET_SETDAT or determine channels for transfer."
            );
        }
        return {
            activeChannels,
            dataType: reportedDType,
            coefWaitTime: coefWait,
            avrStatus: statusJson,
            rawChSetup,
        };
    } catch (error) {
        console.error(`Failed to get AVR status/info: ${error.message}`);
        throw new Error(`Failed during AVR status/info retrieval: ${error.message}`);
    }
}
async function sendTelnetCommands2(
    ip,
    port = 23,
    lpf4LFE = 120,
    bassMode = "LFE",
    isNewModel = false,
    xOver = null
) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        let selectedPreset = null;
        let hasHandledPreset = false;
        let telnetOutputBuffer = "";
        let presetCheckTimer = null;
        let powerCheckTimer = null;
        let powerOnWaitTimer = null;
        let commandSequenceTimer = null;
        let presetConfirmationLogged = false;
        let rl = null;
        let isPowerConfirmed = false;
        const cleanup = (error) => {
            clearTimeout(presetCheckTimer);
            clearTimeout(powerCheckTimer);
            clearTimeout(powerOnWaitTimer);
            clearTimeout(commandSequenceTimer);
            if (rl) {
                try {
                    rl.close();
                } catch (e) {
                    /* ignore */
                }
                rl = null;
            }
            if (client && !client.destroyed) {
                client.end();
                setTimeout(() => {
                    if (client && !client.destroyed) client.destroy();
                }, 1000);
            }
            if (error) {
                console.error("Telnet cleanup with error:", error.message);
                reject(error);
            } else {
                resolve();
            }
        };
        const proceedToCheckPreset = () => {
            if (!client || client.destroyed) return;
            console.log("Power confirmed. Checking preset support...");
            client.write("SPPR ?\r");
            presetCheckTimer = setTimeout(() => {
                if (!hasHandledPreset) {
                    console.log("AVR does not support multiple presets.");
                    hasHandledPreset = true;
                    sendRemainingCommands();
                }
            }, 4000);
        };
        client.on("error", (err) => {
            console.error(`Telnet connection error to ${ip}:${port}: ${err.message}`);
            cleanup(new Error(`Telnet connection failed: ${err.message}`));
        });
        client.on("close", () => {});
        client.connect(port, ip, () => {
            console.log(`Connected to ${ip}:${port}`);
            console.log("Checking power status...");
            isPowerConfirmed = false;
            client.write("ZM?\r");
            powerCheckTimer = setTimeout(() => {
                if (!isPowerConfirmed && client && !client.destroyed) {
                    client.write("ZMON\r");
                    powerOnWaitTimer = setTimeout(() => {
                        if (!isPowerConfirmed) {
                            isPowerConfirmed = true;
                            proceedToCheckPreset();
                        }
                    }, TRANSFER_CONFIG.timeouts.power);
                }
            }, 1000);
        });
        client.on("data", (data) => {
            if (client.destroyed) return;
            const response = data.toString();
            telnetOutputBuffer += response;
            if (!isPowerConfirmed && telnetOutputBuffer.includes("ZMON\r")) {
                isPowerConfirmed = true;
                clearTimeout(powerCheckTimer);
                clearTimeout(powerOnWaitTimer);
                proceedToCheckPreset();
            }
            const presetMatch = telnetOutputBuffer.match(/SPPR\s*([12])\r/);
            if (isPowerConfirmed && !hasHandledPreset && presetMatch) {
                clearTimeout(presetCheckTimer);
                hasHandledPreset = true;
                const currentPreset = presetMatch[1];
                console.log(`Receiver is currently set to Preset ${currentPreset}.`);
                rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                rl.question(
                    "Select preset to store calibration (1 or 2, Enter for current): ",
                    (answer) => {
                        if (rl) {
                            rl.close();
                            rl = null;
                        } else {
                            return;
                        }
                        const choice = answer.trim();
                        if (choice === "1" || choice === "2") {
                            selectedPreset = choice;
                            console.log(`Selected Preset ${selectedPreset}.`);
                        } else {
                            selectedPreset = currentPreset;
                            console.log(`Using current Preset ${selectedPreset}.`);
                        }
                        sendRemainingCommands();
                    }
                );
            } else if (
                selectedPreset &&
                !presetConfirmationLogged &&
                telnetOutputBuffer.includes(`SPPR ${selectedPreset}\r`)
            ) {
                console.log(`Preset successfully set to ${selectedPreset}.`);
                presetConfirmationLogged = true;
            }
        });
        function sendRemainingCommands() {
            clearTimeout(presetCheckTimer);
            const commands = [];
            if (selectedPreset) {
                commands.push(`SPPR ${selectedPreset}`);
            }
            const lfeFormatted = bassMode.toString().trim();
            if (!isNewModel) {
                commands.push("PSSWL OFF");
                commands.push("PSSWL OFF");
                commands.push(`SSSWM ${lfeFormatted}`);
                commands.push(`SSSWM ${lfeFormatted}`);
                console.log(`Setting bass mode to: ${lfeFormatted}`);
            } else {
                commands.push(`SSSWO ${lfeFormatted}`);
                commands.push(`SSSWO ${lfeFormatted}`);
                console.log(`Setting bass mode to: ${lfeFormatted}`);
                if (lfeFormatted === "L+M" && xOver != null) {
                    const xoFormatted = xOver.toString().trim().padStart(3, "0");
                    commands.push(`SSCFRFRO FUL`);
                    commands.push(`SSCFRFRO FUL`);
                    console.log(`Setting front speakers to full range`);
                    commands.push(`SSBELFRO ${xoFormatted}`);
                    commands.push(`SSBELFRO ${xoFormatted}`);
                    console.log(
                        `Setting front speakers' bass extraction frequency to: ${xoFormatted} Hz`
                    );
                }
            }
            const lpfFormatted = lpf4LFE.toString().trim();
            commands.push(`SSLFL ${lpfFormatted}`);
            commands.push(`SSLFL ${lpfFormatted}`);
            console.log(`Setting 'LPF for LFE' to: ${lpfFormatted} Hz`);
            console.log(
                "Double check the above settings have been correctly transferred from your AVR set up menu at the end!"
            );
            let index = 0;
            function sendNext() {
                if (index >= commands.length) {
                    cleanup();
                    return;
                }
                if (!client || client.destroyed) {
                    console.error("Telnet: Connection lost before sending all commands.");
                    cleanup(new Error("Telnet connection lost during command sequence."));
                    return;
                }
                const cmdToSend = commands[index];
                client.write(cmdToSend + "\r");
                index++;
                commandSequenceTimer = setTimeout(sendNext, 1000);
            }
            sendNext();
        }
    });
}
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans.trim());
        })
    );
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function sendTelnetCommands(
    ip,
    port = 23,
    lpf4LFE = 120,
    bassMode = "LFE",
    isNewModel = false,
    xOver = null
) {
    let client = new net.Socket();
    let RLine = null;
    let commandResponseCallback = null;
    let currentCommandTimeoutId = null;
    let currentWaitingCommand = null;
    let lastCommandSentTime = 0;
    const connectPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            if (client && !client.connecting && !client.destroyed) return;
            const msg = `Telnet connection to ${ip}:${port} timed out after ${TELNET_CONFIG.connectTimeout}ms`;
            console.error(msg);
            if (client && !client.destroyed) client.destroy();
            reject(new Error(msg));
        }, TELNET_CONFIG.connectTimeout);
        client.once("error", (err) => {
            clearTimeout(timeoutId);
            const msg = `Telnet connection error to ${ip}:${port}: ${err.message}`;
            console.error(msg);
            if (client && !client.destroyed) client.destroy();
            reject(new Error(msg));
        });
        client.connect(port, ip, () => {
            clearTimeout(timeoutId);
            console.log(`Connected to ${ip}:${port}`);
            client.on("error", (err) => {
                console.error(
                    `Telnet runtime error on ${ip}:${port}: ${err.message}. Current cmd: ${
                        currentWaitingCommand || "N/A"
                    }`
                );
            });
            RLine = readline.createInterface({ input: client });
            RLine.on("line", (line) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return;
                const timeSinceLastTx = currentWaitingCommand
                    ? Date.now() - lastCommandSentTime
                    : -1;
                const forCmdLog = currentWaitingCommand
                    ? `(for "${currentWaitingCommand}", ${timeSinceLastTx}ms after TX)`
                    : "(unsolicited)";
                //console.log(`TELNET RX ${forCmdLog}: ${trimmedLine}`);
                if (commandResponseCallback) {
                    commandResponseCallback(trimmedLine);
                }
            });
            resolve();
        });
    });
    async function executeCommand(
        command,
        expectedResponsePattern,
        timeout = TELNET_CONFIG.commandTimeout,
        retries = TELNET_CONFIG.maxRetries
    ) {
        if (!client || client.destroyed) {
            throw new Error("Telnet client is not connected or has been destroyed.");
        }
        if (expectedResponsePattern === null) {
            currentWaitingCommand = command + " (silent SET)";
            lastCommandSentTime = Date.now();
            //console.log(`TELNET TX (silent SET): ${command}`);
            client.write(command + "\r");
            currentWaitingCommand = null;
            return Promise.resolve();
        }
        for (let attempt = 0; attempt <= retries; attempt++) {
            let attemptCallback = null;
            if (currentCommandTimeoutId) clearTimeout(currentCommandTimeoutId);
            commandResponseCallback = null;
            try {
                return await new Promise((resolveRequest, rejectRequest) => {
                    if (client.destroyed) {
                        rejectRequest(
                            new Error(`Telnet client destroyed before sending "${command}".`)
                        );
                        return;
                    }
                    currentWaitingCommand = command;
                    lastCommandSentTime = Date.now();
                    //console.log(`TELNET TX: ${command} (Attempt ${attempt + 1})`);
                    client.write(command + "\r");
                    attemptCallback = (receivedLine) => {
                        if (commandResponseCallback !== attemptCallback) {
                            //if (command.startsWith("SPPR")) console.log(`DEBUG SPPR?: Stale attemptCallback for "${command}", received "${receivedLine}". Ignoring.`);
                            return;
                        }
                        const isSPPR = command.startsWith("SPPR");
                        //if (isSPPR) console.log(`DEBUG SPPR?: Active cb for "${command}", RX: "${receivedLine}", Pattern: ${expectedResponsePattern}`);
                        let match = false;
                        if (expectedResponsePattern instanceof RegExp) {
                            match = expectedResponsePattern.test(receivedLine);
                            //if (isSPPR) console.log(`DEBUG SPPR?: Regex test result for "${receivedLine}": ${match}`);
                        } else if (typeof expectedResponsePattern === "string") {
                            match = receivedLine
                                .toUpperCase()
                                .includes(expectedResponsePattern.toUpperCase());
                            //if (isSPPR) console.log(`DEBUG SPPR?: String includes for "${receivedLine}": ${match}`);
                        }
                        if (match) {
                            //if (isSPPR) console.log(`DEBUG SPPR?: MATCHED! Resolving for "${command}".`);
                            clearTimeout(currentCommandTimeoutId);
                            commandResponseCallback = null;
                            currentWaitingCommand = null;
                            resolveRequest(receivedLine);
                        }
                    };
                    commandResponseCallback = attemptCallback;
                    currentCommandTimeoutId = setTimeout(() => {
                        if (commandResponseCallback === attemptCallback) {
                            const isSPPR = command.startsWith("SPPR");
                            //if (isSPPR) console.log(`DEBUG SPPR?: TIMEOUT FIRED for "${command}" (attempt ${attempt + 1}).`);
                            const errorMsg = `Timeout (${timeout}ms) waiting for response to "${command}" (attempt ${
                                attempt + 1
                            })`;
                            commandResponseCallback = null;
                            currentWaitingCommand = null;
                            rejectRequest(new Error(errorMsg));
                        }
                    }, timeout);
                });
            } catch (error) {
                //console.warn(`Command "${command}" attempt ${attempt + 1}/${retries + 1} failed: ${error.message}`);
                if (commandResponseCallback === attemptCallback) commandResponseCallback = null;
                if (attempt === retries) {
                    currentWaitingCommand = null;
                    throw error;
                }
                await new Promise((res) => setTimeout(res, 300 + attempt * 200));
            }
        }
        currentWaitingCommand = null;
        throw new Error(`Command "${command}" failed exhaustively in executeCommand.`);
    }
    try {
        await connectPromise;
        console.log("Checking power status...");
        let powerStatusResponse = await executeCommand(
            "ZM?",
            /ZM(ON|OFF)/i,
            TELNET_CONFIG.commandTimeout
        );
        if (powerStatusResponse.toUpperCase().includes("ZMOFF")) {
            console.log("Device is off. Turning on...");
            await executeCommand("ZMON", /ZMON/i, TELNET_CONFIG.commandTimeout);
            console.log(`Waiting ${TELNET_CONFIG.powerOnDelay / 1000}s for device to power up...`);
            await new Promise((resolve) => setTimeout(resolve, TELNET_CONFIG.powerOnDelay));
            const newPowerStatus = await executeCommand(
                "ZM?",
                /ZM(ON|OFF)/i,
                TELNET_CONFIG.commandTimeout
            );
            if (!newPowerStatus.toUpperCase().includes("ZMON")) {
                console.warn("Device reported not ON after ZMON attempt. Proceeding cautiously.");
            } else {
                console.log("Device confirmed ON.");
            }
        } else {
            console.log("Device is on.");
        }
        let selectedPreset = null;
        let currentAVRPreset = null;
        console.log("Checking preset support...");
        try {
            const spprQueryPattern = /^SPPR\s*(1|2)(\r)?$/i;
            const presetQueryResponse = await executeCommand(
                "SPPR ?",
                spprQueryPattern,
                TELNET_CONFIG.presetQueryTimeout
            );
            const match = presetQueryResponse.match(spprQueryPattern);
            if (match && match[1]) {
                currentAVRPreset = match[1]; // Store '1' or '2'
            } else {
                console.warn(
                    `WARN: SPPR ? response "${presetQueryResponse}" received but preset number not extracted. Assuming no presets.`
                );
            }
        } catch (error) {
            if (error.message.includes('Timeout waiting for response to "SPPR ?"')) {
                console.log(
                    'No response to "SPPR ?" (timeout), assuming AVR does not support multiple presets.'
                );
            } else {
                console.warn(
                    `Error during "SPPR ?" query: ${error.message}. Assuming no preset support.`
                );
            }
        }
        if (currentAVRPreset) {
            console.log(`Receiver is currently set to Preset ${currentAVRPreset}.`);
            console.log("\n************************************************************");
            console.log("****           PRESET SELECTION REQUIRED!               ****");
            console.log("**** Look below for the input prompt. Press Enter to    ****");
            console.log("**** use the current preset, or type 1 or 2.          ****");
            console.log("************************************************************\n");
            const answer = await askQuestion(
                `>>> Select preset to store calibration (${
                    currentAVRPreset === "1" ? "1 or 2" : "2 or 1"
                }, Enter for current '${currentAVRPreset}'): `
            );
            console.log("--- Preset selection received. Continuing... ---\n");
            if (answer === "1" || answer === "2") {
                selectedPreset = answer;
            } else {
                selectedPreset = currentAVRPreset;
                console.log(
                    `No specific preset chosen, or input invalid. Using current Preset ${currentAVRPreset}.`
                );
            }
            console.log(`Target Preset for calibration: ${selectedPreset}.`);
            if (selectedPreset !== currentAVRPreset) {
                console.log(`Changing AVR to Preset ${selectedPreset}...`);
                try {
                    await executeCommand(
                        `SPPR ${selectedPreset}`,
                        new RegExp(`^SPPR\\s*${selectedPreset}(\\r)?$`, "i"),
                        TELNET_CONFIG.presetQueryTimeout
                    );
                    console.log(`Calibration will be transferred to Preset ${selectedPreset}.`);
                } catch (error) {
                    console.error(
                        `ERROR: Failed to set AVR to Preset ${selectedPreset}: ${error.message}`
                    );
                    console.warn(
                        `Calibration will proceed on current AVR Preset ${currentAVRPreset} instead of target ${selectedPreset}.`
                    );
                    selectedPreset = currentAVRPreset;
                }
            } else {
                console.log(
                    `AVR is already on the target Preset ${selectedPreset}. No change needed.`
                );
            }
        } else {
            console.log(
                "Proceeding without preset selection (AVR does not support multiple presets)."
            );
        }
        console.log("Sending required calibration configuration commands...");
        const audioCommandDefinitions = [];
        const lfeFormatted = bassMode.toString().trim().toUpperCase();
        const lpfValForCmd = lpf4LFE.toString().trim().padStart(3, "0");
        if (!isNewModel) {
            audioCommandDefinitions.push({
                desc: "Set Subwoofer Level to OFF (older models)",
                cmdSet: "PSSWL OFF",
                expectsDirectEchoForSet: true,
            });
            audioCommandDefinitions.push({
                desc: `Set Bass Mode to ${lfeFormatted}`,
                cmdSet: `SSSWM ${lfeFormatted}`,
                cmdQuery: "SSSWM ?",
                verifyQueryPattern: new RegExp(`^SSSWM ${escapeRegExp(lfeFormatted)}(\\r)?$`, "i"),
            });
            audioCommandDefinitions.push({
                desc: `Set LPF for LFE to ${lpfValForCmd} Hz`,
                cmdSet: `SSLFL ${lpfValForCmd}`,
                cmdQuery: "SSLFL ?",
                verifyQueryPattern: new RegExp(
                    `^SSLFL\\s?${escapeRegExp(lpfValForCmd)}(\\r)?$`,
                    "i"
                ),
            });
        } else {
            audioCommandDefinitions.push({
                desc: `Set Subwoofer Mode to ${lfeFormatted}`,
                cmdSet: `SSSWO ${lfeFormatted}`,
                cmdQuery: "SSSWO ?",
                verifyQueryPattern: new RegExp(`^SSSWO ${escapeRegExp(lfeFormatted)}(\\r)?$`, "i"),
            });
            if (lfeFormatted === "L+M" && xOver != null) {
                const xoFormattedForCmd = xOver.toString().trim().padStart(3, "0");
                audioCommandDefinitions.push({
                    desc: `Set Front Speakers to Full Range`,
                    cmdSet: `SSCFRFRO FUL`,
                    expectsDirectEchoForSet: true,
                });
                audioCommandDefinitions.push({
                    desc: `Set Front Bass Extraction to ${xoFormattedForCmd} Hz`,
                    cmdSet: `SSBELFRO ${xoFormattedForCmd}`,
                    expectsDirectEchoForSet: true,
                });
            }
            audioCommandDefinitions.push({
                desc: `Set LPF for LFE to ${lpfValForCmd} Hz`,
                cmdSet: `SSLFL ${lpfValForCmd}`,
                cmdQuery: "SSLFL ?",
                verifyQueryPattern: new RegExp(
                    `^SSLFL\\s?${escapeRegExp(lpfValForCmd)}(\\r)?$`,
                    "i"
                ),
            });
        }
        for (const cmdDef of audioCommandDefinitions) {
            const {
                desc,
                cmdSet,
                cmdQuery,
                verifyQueryPattern,
                expectsDirectEchoForSet = false,
                directEchoPattern: explicitDirectEchoPatternFromDef,
            } = cmdDef;
            console.log(`Processing: ${desc}`);
            let commandConfirmed = false;
            if (expectsDirectEchoForSet) {
                const patternForDirectEcho =
                    explicitDirectEchoPatternFromDef instanceof RegExp
                        ? explicitDirectEchoPatternFromDef
                        : new RegExp(`^${escapeRegExp(cmdSet.replace(/\+/g, "\\+"))}`, "i");
                try {
                    await executeCommand(
                        cmdSet,
                        patternForDirectEcho,
                        TELNET_CONFIG.commandTimeout
                    );
                    commandConfirmed = true;
                } catch (error) {
                    if (!cmdQuery) {
                        if (cmdSet === "PSSWL OFF") {
                            commandConfirmed = true;
                        } else {
                            console.error(
                                `  ERROR: No query verification available for "${cmdSet}" after failed direct echo. Command may have failed.`
                            );
                        }
                    }
                }
            } else {
                await executeCommand(cmdSet, null);
                //console.log(`  SET command "${cmdSet}" sent (will verify with query if available).`);
            }
            if (cmdQuery && verifyQueryPattern && !commandConfirmed) {
                //console.log(`  Waiting ${TELNET_CONFIG.setCommandSettleTime}ms before querying for "${cmdSet}"...`);
                await new Promise((resolve) =>
                    setTimeout(resolve, TELNET_CONFIG.setCommandSettleTime)
                );
                //console.log(`  Querying with "${cmdQuery}"...`);
                try {
                    const timeoutForThisQuery =
                        cmdQuery === "SSBELFRO ?" || cmdQuery === "SSCFRFRO ?"
                            ? Math.floor(TELNET_CONFIG.queryResponseTimeout * 1.5)
                            : TELNET_CONFIG.queryResponseTimeout;
                    const queryResponse = await executeCommand(
                        cmdQuery,
                        verifyQueryPattern,
                        timeoutForThisQuery
                    );
                    //console.log(`  SUCCESS: Query for "${cmdSet}" confirmed value. Response: "${queryResponse}"`);
                    commandConfirmed = true;
                } catch (error) {
                    //console.error(`  ERROR: Verification query FAILED for "${cmdSet}". Query "${cmdQuery}" response error: ${error.message}`);
                    console.warn(
                        `  AVR setting for "${desc}" might be incorrect. Please verify manually.`
                    );
                }
            } else if (commandConfirmed) {
                // Already confirmed (either by direct echo, or by query, or by optimistic PSSWL OFF retry)
            } else if (!cmdQuery && !expectsDirectEchoForSet) {
                //console.log(`  Command "${cmdSet}" sent (no echo expected, no query). Assuming success after settle time.`);
                await new Promise((resolve) =>
                    setTimeout(resolve, TELNET_CONFIG.setCommandSettleTime)
                );
                commandConfirmed = true; // Assume success for this type
            }
            if (!commandConfirmed) {
                console.warn(
                    `Warning: Command "${desc}" (${cmdSet}) could not be fully confirmed.`
                );
            }
        }
        console.log(
            "IMPORTANT: Please double-check the above settings in your AVR menu, especially if any warnings or errors were reported!"
        );
    } catch (error) {
        //console.error("\n--- Telnet Operation FAILED ---");
        console.error("Error:", error.message);
        if (error.stack) console.error("Stack:", error.stack);
        throw error;
    } finally {
        //console.log("\nCleaning up Telnet connection...");
        if (RLine) {
            try {
                RLine.close();
            } catch (e) {
                /* ignore */
            }
            RLine = null;
        }
        clearTimeout(currentCommandTimeoutId);
        commandResponseCallback = null;
        currentWaitingCommand = null;
        if (client && !client.destroyed) {
            client.end(() => {
                if (client && !client.destroyed) client.destroy();
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (client && !client.destroyed) {
                client.destroy();
            }
        }
        client = null;
    }
}
async function selectOcaFile(searchDirectory) {
    let files;
    try {
        if (!fs.existsSync(searchDirectory)) {
            throw new Error(`Directory not found: ${searchDirectory}`);
        }
        files = fs
            .readdirSync(searchDirectory)
            .filter((file) => path.extname(file).toLowerCase() === ".oca");
    } catch (err) {
        throw new Error(`Error reading directory ${searchDirectory}: ${err.message}`);
    }
    if (files.length === 0) {
        throw new Error(
            `No .oca files found in the application directory: ${searchDirectory}\nPlease place your generated .oca file there.`
        );
    }
    const sortedFiles = files
        .map((file) => {
            const fullPath = path.join(searchDirectory, file);
            try {
                return {
                    name: file,
                    path: fullPath,
                    mtime: fs.statSync(fullPath).mtime,
                };
            } catch (statErr) {
                console.warn(
                    `Warning: Could not get stats for file ${fullPath}: ${statErr.message}`
                );
                return null;
            }
        })
        .filter((fileInfo) => fileInfo !== null)
        .sort((a, b) => b.mtime - a.mtime);
    if (sortedFiles.length === 0) {
        throw new Error(
            `Found .oca files but could not read their modification times in: ${searchDirectory}`
        );
    }
    console.log("\nAvailable calibration (.oca) files (most recent first):");
    sortedFiles.forEach((file, index) => {
        console.log(`  ${index + 1}: ${file.name} (Modified: ${file.mtime.toLocaleString()})`);
    });
    console.log(`  ${sortedFiles.length + 1}: Enter file path manually`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
        rl.question(
            `\nSelect file number to transfer (1-${sortedFiles.length + 1}, Enter for 1): `,
            resolve
        );
    });
    rl.close();
    const choice = answer.trim();
    if (choice === "") {
        console.log(`Using most recent file: ${sortedFiles[0].name}`);
        return sortedFiles[0].path;
    }
    const selectedIndex = parseInt(choice);
    if (selectedIndex === sortedFiles.length + 1) {
        const rlPath = readline.createInterface({ input: process.stdin, output: process.stdout });
        const manualPath = await new Promise((resolve) =>
            rlPath.question("Enter full path to .oca file: ", resolve)
        );
        rlPath.close();
        if (!manualPath) throw new Error("Manual path entry cancelled or empty.");
        const normalizedManualPath = path.resolve(manualPath.trim());
        if (!fs.existsSync(normalizedManualPath)) {
            throw new Error(`File not found: ${normalizedManualPath}`);
        }
        if (path.extname(normalizedManualPath).toLowerCase() !== ".oca") {
            throw new Error(`Selected file is not a .oca file: ${normalizedManualPath}`);
        }
        console.log(`Using manually entered file: ${normalizedManualPath}`);
        return normalizedManualPath;
    } else if (selectedIndex >= 1 && selectedIndex <= sortedFiles.length) {
        const selectedFile = sortedFiles[selectedIndex - 1];
        console.log(`Using selected file: ${selectedFile.name}`);
        return selectedFile.path;
    } else {
        throw new Error(
            `Invalid selection: ${choice}. Please enter a number between 1 and ${
                sortedFiles.length + 1
            }.`
        );
    }
}
function buildPacketConfig(totalFloats) {
    if (typeof totalFloats !== "number" || isNaN(totalFloats) || totalFloats < 0) {
        console.warn(
            `buildPacketConfig called with invalid totalFloats: ${totalFloats} (Type: ${typeof totalFloats}). Returning default empty config.`
        );
        return {
            totalFloats: 0,
            packetCount: 0,
            fullPacketCountField: "00",
            firstPacketFloats: 0,
            midPacketFloats: 128,
            lastPacketFloats: 0,
        };
    }
    if (totalFloats === 0) {
        console.warn("buildPacketConfig called with totalFloats === 0. Returning empty config.");
        return {
            totalFloats: 0,
            packetCount: 0,
            fullPacketCountField: "00",
            firstPacketFloats: 0,
            midPacketFloats: 128,
            lastPacketFloats: 0,
        };
    }
    const firstPacketFloatPayload = 127;
    const midPacketFloatPayload = 128;
    let packetCount;
    let firstPacketActualFloats;
    let lastPacketFloats;
    if (totalFloats <= firstPacketFloatPayload) {
        packetCount = 1;
        firstPacketActualFloats = totalFloats;
        lastPacketFloats = totalFloats;
    } else {
        firstPacketActualFloats = firstPacketFloatPayload;
        const remainingFloats = totalFloats - firstPacketActualFloats;
        const numAdditionalPackets = Math.ceil(remainingFloats / midPacketFloatPayload);
        packetCount = 1 + numAdditionalPackets;
        const remainder = remainingFloats % midPacketFloatPayload;
        if (numAdditionalPackets === 0) {
            lastPacketFloats = 0;
        } else if (remainder === 0) {
            lastPacketFloats = midPacketFloatPayload;
        } else {
            lastPacketFloats = remainder;
        }
    }
    const lastSequenceNumber = packetCount - 1;
    if (lastSequenceNumber < 0 || lastSequenceNumber > 255) {
        console.warn(
            `Warning: Calculated last sequence number (${lastSequenceNumber}) is out of valid byte range (0-255). Clamping or protocol issue?`
        );
        if (lastSequenceNumber > 255) {
            throw new Error(
                `Calculated packet count (${packetCount}) exceeds protocol limit (256 packets).`
            );
        }
        if (lastSequenceNumber < 0) {
            console.error("CRITICAL ERROR in buildPacketConfig: lastSequenceNumber is negative.");
            return {
                totalFloats: 0,
                packetCount: 0,
                lastSequenceNumField: "00",
                firstPacketFloats: 0,
                midPacketFloats: 128,
                lastPacketFloats: 0,
            };
        }
    }
    const lastSequenceNumField = (lastSequenceNumber & 0xff).toString(16).padStart(2, "0");
    const result = {
        totalFloats,
        packetCount,
        lastSequenceNumField: lastSequenceNumField,
        firstPacketFloats: firstPacketActualFloats,
        midPacketFloats: midPacketFloatPayload,
        lastPacketFloats: lastPacketFloats,
    };
    return result;
}
function javaFloatToFixed32bits(f) {
    const isNegative = f < 0.0;
    const absF = Math.abs(f);
    let resultInt = 0;
    if (absF >= 1.0) {
        resultInt = 0x7fffffff;
    } else {
        let f2 = absF;
        resultInt = 0;
        for (let i2 = 0; i2 < 31; i2++) {
            resultInt <<= 1;
            f2 = (f2 - Math.trunc(f2)) * 2.0;
            if (f2 >= 1.0) {
                resultInt |= 1;
            }
        }
    }
    if (isNegative) {
        resultInt = ~resultInt | 0x80000000;
    }
    return resultInt;
}
const floatToBufferLE = (float) => {
    const buf = Buffer.alloc(BYTES_PER_FLOAT);
    buf.writeFloatLE(float, 0);
    return buf;
};
const fixed32IntToBufferLE = (fixedInt) => {
    fixedInt = Math.max(-2147483648, Math.min(2147483647, fixedInt));
    const buf = Buffer.alloc(BYTES_PER_FLOAT);
    buf.writeInt32LE(fixedInt, 0);
    return buf;
};
const addCheckSum = (hex) => {
    if (typeof hex !== "string" || hex.length % 2 !== 0) {
        const preview = typeof hex === "string" ? hex.slice(0, 20) : "Not a string";
        throw new Error(
            `Hex string for checksum must have even length. Received length ${hex?.length}. Start: ${preview}...`
        );
    }
    let checksum = 0;
    for (let i = 0; i < hex.length; i += 2) {
        checksum = (checksum + parseInt(hex.substring(i, i + 2), 16)) & 0xff;
    }
    const checksumHex = checksum.toString(16).padStart(2, "0");
    return Buffer.from(hex + checksumHex, "hex");
};
function getChannelTypeByte(commandId, multEqType, isGriffin = false) {
    const entry = channelByteTable[commandId];
    if (!entry) {
        throw new Error(`Unknown channel commandId: ${commandId}. Cannot determine channel byte.`);
    }
    if (isGriffin && entry.griffin !== null) {
        return entry.griffin;
    }
    if (isGriffin && entry.griffin === null) {
        console.warn(
            `⚠ Griffin channel byte requested but not available for ${commandId}, falling back to standard mapping...`
        );
    }
    if (multEqType === "XT32") {
        if (entry.eq2 !== null) return entry.eq2;
        console.warn(
            `⚠ XT32 channel byte requested for ${commandId}, but eq2 mapping is null. Falling back...`
        );
        if (entry.neq2 !== null) return entry.neq2;
    }
    if (multEqType === "XT" || multEqType === "MultEQ") {
        if (entry.neq2 !== null) return entry.neq2;
        console.warn(
            `⚠ ${multEqType} channel byte requested for ${commandId}, but neq2 mapping is null. Falling back...`
        );
        if (entry.eq2 !== null) return entry.eq2;
    }
    if (entry.neq2 !== null) return entry.neq2;
    if (entry.eq2 !== null) return entry.eq2;
    if (isGriffin && entry.griffin !== null) return entry.griffin;
    throw new Error(
        `No suitable channel byte mapping found for ${commandId} with MultEQ type ${multEqType} (Griffin: ${isGriffin}). Check channelByteTable.`
    );
}
const createCommandSender = (socket) => {
    return async (
        payload,
        label,
        { timeout = TRANSFER_CONFIG.timeouts.command, addChecksum = true, expectAck = true } = {}
    ) => {
        return new Promise((resolve, reject) => {
            let packet;
            try {
                if (addChecksum) {
                    if (typeof payload !== "string") {
                        return reject(
                            new Error(
                                `[${label}] Payload must be a hex string when addChecksum is true.`
                            )
                        );
                    }
                    packet = addCheckSum(payload);
                } else {
                    if (Buffer.isBuffer(payload)) {
                        packet = payload;
                    } else if (typeof payload === "string") {
                        packet = Buffer.from(payload, "hex");
                    } else {
                        return reject(
                            new Error(
                                `[${label}] Payload must be a Buffer or hex string when addChecksum is false.`
                            )
                        );
                    }
                }
            } catch (e) {
                return reject(new Error(`[${label}] Error preparing packet: ${e.message}`));
            }
            let responseBuffer = Buffer.alloc(0);
            let timer = null;
            let cleanedUp = false;
            const cleanup = (success, reason, isNackOrError = false) => {
                if (cleanedUp) return;
                cleanedUp = true;
                clearTimeout(timer);
                socket.off("data", dataHandler);
                socket.off("error", errorHandler);
                socket.off("close", closeHandler);
                if (isNackOrError) {
                    console.log(`!!! Failed: ${label} - ${reason}`);
                    reject(new Error(`${label}: ${reason}`));
                } else if (success) {
                    resolve(true);
                } else {
                    console.error(`!!! Timeout/Error: ${label} - ${reason}`);
                    reject(new Error(`${label}: ${reason}`));
                }
            };
            const dataHandler = (data) => {
                if (cleanedUp) return;
                responseBuffer = Buffer.concat([responseBuffer, data]);
                const textResponse = responseBuffer.toString("utf8");
                if (
                    textResponse.includes("NAK") ||
                    textResponse.includes("NACK") ||
                    textResponse.includes("ERROR")
                ) {
                    cleanup(false, "Receiver rejected command (NAK/ERROR)", true);
                    return;
                }
                if (expectAck && textResponse.includes("ACK")) {
                    cleanup(true, "Receiver acknowledged (ACK)");
                    return;
                }
                if (textResponse.includes("INPROGRESS")) {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        if (!cleanedUp) {
                            cleanup(false, `Timed out after INPROGRESS (>${timeout}ms)`);
                        }
                    }, timeout);
                }
                if (expectAck && responseBuffer.length > 2048 && !textResponse.includes("ACK")) {
                    console.warn(
                        `[${label}] Large response buffer (${responseBuffer.length} bytes) without ACK. Possible issue.`
                    );
                }
            };
            const errorHandler = (err) => {
                if (cleanedUp) return;
                cleanup(false, `Connection error: ${err.message}`, true);
            };
            const closeHandler = (hadError) => {
                if (cleanedUp) return;
                cleanup(false, `Connection closed unexpectedly (hadError: ${hadError})`, true);
            };
            const effectiveTimeout = expectAck ? timeout : TRANSFER_CONFIG.timeouts.nonAckPacket;
            timer = setTimeout(() => {
                if (!cleanedUp) {
                    cleanup(
                        !expectAck,
                        expectAck ? "No response/ACK received" : "Command sent (no ACK expected)"
                    );
                }
            }, effectiveTimeout);
            socket.on("data", dataHandler);
            socket.on("error", errorHandler);
            socket.once("close", closeHandler);
            try {
                socket.write(packet, (err) => {
                    if (err) {
                        if (!cleanedUp) cleanup(false, `Socket write failed: ${err.message}`, true);
                    }
                });
            } catch (err) {
                if (!cleanedUp) cleanup(false, `Synchronous send error: ${err.message}`, true);
            }
        });
    };
};
function buildAvrPacket(commandName, jsonPayloadString, seqNum = 0, lastSeqNum = 0) {
    const commandBytes = Buffer.from(commandName, "utf8");
    const parameterBytes = Buffer.from(jsonPayloadString, "utf8");
    const parameterLength = parameterBytes.length;
    const commandBytesLength = commandBytes.length;
    if (parameterLength > 0xffff) {
        throw new Error(`JSON Payload too large (${parameterLength} bytes), exceeds 65535 limit.`);
    }
    const headerFixedOverhead = 1 + 2 + 1 + 1 + 1 + 2;
    const totalLength = headerFixedOverhead + commandBytesLength + parameterLength + 1;
    if (totalLength > 0xffff) {
        throw new Error(`Total packet size (${totalLength} bytes) exceeds 65535 limit.`);
    }
    const buffer = Buffer.alloc(totalLength);
    let offset = 0;
    buffer.writeUInt8(0x54, offset);
    offset += 1;
    buffer.writeUInt16BE(totalLength, offset);
    offset += 2;
    buffer.writeUInt8(seqNum & 0xff, offset);
    offset += 1;
    buffer.writeUInt8(lastSeqNum & 0xff, offset);
    offset += 1;
    commandBytes.copy(buffer, offset);
    offset += commandBytes.length;
    buffer.writeUInt8(0x00, offset);
    offset += 1;
    buffer.writeUInt16BE(parameterLength, offset);
    offset += 2;
    parameterBytes.copy(buffer, offset);
    offset += parameterBytes.length;
    let checksum = 0;
    for (let i = 0; i < offset; i++) {
        checksum = (checksum + buffer[i]) & 0xff;
    }
    buffer.writeUInt8(checksum, offset);
    offset += 1;
    if (offset !== totalLength) {
        console.error(
            `buildAvrPacket ERROR: Final offset ${offset} !== Calculated Total Length ${totalLength}`
        );
        console.error(
            `  Command: ${commandName}, Payload: ${jsonPayloadString.substring(0, 50)}...`
        );
        throw new Error("Packet construction length mismatch!");
    }
    return buffer;
}
function mapChannelIdForSetDat(id) {
    switch (id) {
        case "SWLFE":
            return "SW1";
        case "SWLFE2SP":
            return "SW1";
        case "SWLEFT2SP":
            return "SW1";
        case "SWRIGHT2SP":
            return "SW2";
        case "SWFRONT2SP":
            return "SW1";
        case "SWBACK2SP":
            return "SW2";
        case "SWLFE3SP":
            return "SW1";
        case "SWLEFT3SP":
            return "SW1";
        case "SWRIGHT3SP":
            return "SW2";
        case "SWFRONTLEFT3SP":
            return "SW1";
        case "SWFRONTRIGHT3SP":
            return "SW2";
        case "SWREAR3SP":
            return "SW3";
        case "SWLFE4SP":
            return "SW1";
        case "SWFRONTLEFT4SP":
            return "SW1";
        case "SWFRONTRIGHT4SP":
            return "SW2";
        case "SWBACKLEFT4SP":
            return "SW3";
        case "SWBACKRIGHT4SP":
            return "SW4";
        case "SWMIX1":
            return "SW1";
        case "SWMIX2":
            return "SW2";
        case "SWMIX3":
            return "SW3";
        case "SWMIX4":
            return "SW4";
        default:
            return id;
    }
}
function prepareParamsInOrder(
    avrStatus,
    rawChSetup,
    filterData,
    sortedChannelInfo,
    multEqType,
    hasGriffinLiteDSP
) {
    const isNew = filterData.isNewModel;
    const params = [];
    const DfSettingDataParameters = [
        "AmpAssign",
        "AssignBin",
        "SpConfig",
        "Distance",
        "ChLevel",
        "Crossover",
        "AudyFinFlg",
        "AudyDynEq",
        "AudyEqRef",
        "AudyDynVol",
        "AudyDynSet",
        "AudyMultEq",
        "AudyEqSet",
        "AudyLfc",
        "AudyLfcLev",
        "SWSetup",
    ];
    const sourceAmpAssign = avrStatus.AmpAssign;
    const sourceAssignBin = avrStatus.AssignBin;
    if (!sourceAmpAssign || !sourceAssignBin)
        throw new Error(
            "AmpAssign or AssignBin missing from AVR Status. This is a critical prerequisite!"
        );
    const calibrationSettings = {
        AudyFinFlg: "NotFin",
        AudyDynEq: false,
        AudyEqRef: 0,
        AudyDynVol: false,
        AudyDynSet: "L",
        AudyMultEq: true,
        AudyEqSet: "Flat",
        AudyLfc: false,
        AudyLfcLev: 3,
    };
    let subSetup = null;
    const useSWSetup =
        avrStatus.SWSetup &&
        typeof avrStatus.SWSetup === "object" &&
        avrStatus.SWSetup.SWNum !== undefined;
    if (useSWSetup) {
        const swNum = parseInt(avrStatus.SWSetup.SWNum, 10);
        if (!isNaN(swNum) && swNum > 0)
            subSetup = { SWNum: swNum, SWMode: "Standard", SWLayout: "N/A" };
    }
    if (!filterData || !filterData.channels || !Array.isArray(filterData.channels))
        throw new Error("Invalid or missing 'channels' array in '.oca' file data!");
    if (!rawChSetup || !Array.isArray(rawChSetup))
        throw new Error("Missing or invalid channel status!");
    if (!sortedChannelInfo || !Array.isArray(sortedChannelInfo))
        throw new Error("Missing or invalid active channels list!");
    const avrRecognizedMappedIds = new Set();
    for (const entry of rawChSetup) {
        const id = Object.keys(entry)[0];
        if (id) {
            avrRecognizedMappedIds.add(mapChannelIdForSetDat(id));
        } else {
            throw new Error("Invalid channel ID key!");
        }
    }
    for (const ocaChannel of filterData.channels) {
        if (!ocaChannel.commandId)
            throw new Error(
                "Channel entry in '.oca' file is missing its 'commandId'. Transfer cannot proceed."
            );
        const mappedOcaChannelId = mapChannelIdForSetDat(ocaChannel.commandId);
        if (!avrRecognizedMappedIds.has(mappedOcaChannelId))
            throw new Error(
                `Configuration Mismatch Error: Channel ${mappedOcaChannelId} (from '.oca' file's commandId: '${ocaChannel.commandId}') is defined in the '.oca' file, but this channel ID is NOT RECOGNIZED by the AVR in its current setup!`
            );
    }
    const finalSpConfig = [];
    const distanceArray = [];
    const chLevelArray = [];
    const crossoverArray = [];
    for (const channelInfo of sortedChannelInfo) {
        const avrOriginalChannelId = channelInfo.id;
        const avrMappedChannelId = channelInfo.mappedId;
        const avrSetupEntry = rawChSetup.find(
            (entry) => Object.keys(entry)[0] === avrOriginalChannelId
        );
        let avrReportedSpeakerType = "S";
        if (avrSetupEntry) {
            avrReportedSpeakerType = avrSetupEntry[avrOriginalChannelId];
            if (!avrReportedSpeakerType || typeof avrReportedSpeakerType !== "string") {
                throw new Error(
                    `AVR reported an invalid type for ${avrOriginalChannelId}: ${avrReportedSpeakerType}!`
                );
            }
        } else {
            throw new Error(
                `Could not find setup entry for active channel ${avrOriginalChannelId}!`
            );
        }
        const ocaChannel = filterData.channels.find(
            (ch) => mapChannelIdForSetDat(ch.commandId) === avrMappedChannelId
        );
        if (!ocaChannel)
            throw new Error(
                `Data Mismatch Error: Channel ${avrMappedChannelId} (from AVR's active channel ${avrOriginalChannelId}) is active on the AVR but NOT defined in the .oca file. Transfer cannot proceed.`
            );
        let ocaSpeakerTypeForThisChannel = ocaChannel.speakerType;
        if (
            ocaSpeakerTypeForThisChannel !== "S" &&
            ocaSpeakerTypeForThisChannel !== "E" &&
            ocaSpeakerTypeForThisChannel !== "L"
        )
            throw new Error(
                `Channel ${avrMappedChannelId} in '.oca' file has an invalid speakerType '${ocaSpeakerTypeForThisChannel}'. Must be 'S', 'E' or 'L'.`
            );
        let finalTypeForSpConfig = ocaSpeakerTypeForThisChannel;
        finalSpConfig.push({ [avrMappedChannelId]: finalTypeForSpConfig });
        if (ocaChannel.distanceInMeters !== undefined && ocaChannel.distanceInMeters !== null) {
            distanceArray.push({
                [avrMappedChannelId]: Math.round(ocaChannel.distanceInMeters * 100),
            });
        } else {
            throw new Error(
                `Distance missing for ${avrMappedChannelId} (orig: ${avrOriginalChannelId}) in OCA file!`
            );
        }
        if (
            ocaChannel.trimAdjustmentInDbs !== undefined &&
            ocaChannel.trimAdjustmentInDbs !== null
        ) {
            chLevelArray.push({
                [avrMappedChannelId]: Math.round(ocaChannel.trimAdjustmentInDbs * 10),
            });
        } else {
            throw new Error(
                `Trim/Level missing for ${avrMappedChannelId} (orig: ${avrOriginalChannelId}) in OCA file!`
            );
        }
        const isEffectivelySubwoofer = finalTypeForSpConfig === "E";
        const isNewAndLarge = isNew && finalTypeForSpConfig === "L";
        if (isEffectivelySubwoofer || isNewAndLarge) {
            crossoverArray.push({ [avrMappedChannelId]: "F" });
        } else {
            if (ocaChannel.xover !== undefined && ocaChannel.xover !== null) {
                let xoverValueToSet;
                if (
                    typeof ocaChannel.xover === "string" &&
                    ocaChannel.xover.toUpperCase() === "F"
                ) {
                    console.warn(
                        `Speaker ${avrMappedChannelId} (intended type 'S') in '.oca' file is specified with "F" crossover, which is invalid for a small speaker.`
                    );
                } else {
                    const numericXover = Number(ocaChannel.xover);
                    if (!isNaN(numericXover) && numericXover >= 40 && numericXover <= 250) {
                        xoverValueToSet = numericXover;
                    } else {
                        throw new Error(
                            `Invalid numeric crossover value ('${ocaChannel.xover}') for speaker ${avrMappedChannelId} in '.oca' file. Must be between 40 and 250.`
                        );
                    }
                }
                crossoverArray.push({ [avrMappedChannelId]: xoverValueToSet });
            } else {
                throw new Error(
                    `Crossover missing for speaker ${avrMappedChannelId} (intended type 'S') in '.oca' file!`
                );
            }
        }
    }
    for (const key of DfSettingDataParameters) {
        let value = undefined;
        switch (key) {
            case "AmpAssign":
                value = sourceAmpAssign;
                break;
            case "AssignBin":
                value = sourceAssignBin;
                break;
            case "SpConfig":
                value = finalSpConfig.length > 0 ? finalSpConfig : undefined;
                break;
            case "Distance":
                value = distanceArray.length > 0 ? distanceArray : undefined;
                break;
            case "ChLevel":
                value = chLevelArray.length > 0 ? chLevelArray : undefined;
                break;
            case "Crossover":
                value = crossoverArray.length > 0 ? crossoverArray : undefined;
                break;
            case "AudyFinFlg":
                value = calibrationSettings.AudyFinFlg;
                break;
            case "AudyDynEq":
                value = calibrationSettings.AudyDynEq;
                break;
            case "AudyEqRef":
                value = calibrationSettings.AudyEqRef;
                break;
            case "AudyDynVol":
                value = calibrationSettings.AudyDynVol;
                break;
            case "AudyDynSet":
                value = calibrationSettings.AudyDynSet;
                break;
            case "AudyMultEq":
                value = calibrationSettings.AudyMultEq;
                break;
            case "AudyEqSet":
                value = calibrationSettings.AudyEqSet;
                break;
            case "AudyLfc":
                value = calibrationSettings.AudyLfc;
                break;
            case "AudyLfcLev":
                value = calibrationSettings.AudyLfcLev;
                break;
            case "SWSetup":
                value = subSetup;
                break;
        }
        if (value !== undefined && value !== null) params.push({ key, value });
    }
    return params;
}
async function sendSetDatCommand(
    sendFunction,
    avrStatus,
    rawChSetup,
    filterData,
    sortedChannelInfo,
    multEqType,
    hasGriffinLiteDSP
) {
    const BINARY_PACKET_THRESHOLD = 510;
    const COMMAND_NAME = "SET_SETDAT";
    let orderedParams;
    try {
        orderedParams = prepareParamsInOrder(
            avrStatus,
            rawChSetup,
            filterData,
            sortedChannelInfo,
            multEqType,
            hasGriffinLiteDSP
        );
    } catch (error) {
        console.error(`Error preparing SET_SETDAT parameters: ${error.message}`);
        throw new Error(`Failed to prepare SET_SETDAT command: ${error.message}`);
    }
    if (orderedParams.length === 0) {
        console.warn("No parameters generated for SET_SETDAT. Skipping command.");
        return;
    }
    let packetsJsonStrings = [];
    let currentPacketPayload = {};
    for (let i = 0; i < orderedParams.length; i++) {
        const paramInfo = orderedParams[i];
        const paramKey = paramInfo.key;
        const paramValue = paramInfo.value;
        let testPacketPayload = { ...currentPacketPayload };
        testPacketPayload[paramKey] = paramValue;
        let testJsonString = "";
        let testBuffer;
        try {
            testJsonString = JSON.stringify(testPacketPayload);
            testBuffer = buildAvrPacket(COMMAND_NAME, testJsonString, 0, 0);
        } catch (buildError) {
            console.error(
                `!!! ERROR building test packet for parameter "${paramKey}": ${buildError.message}`
            );
            console.error(`   Payload causing issue:`, testPacketPayload);
            throw new Error(`Failed to build test packet for ${paramKey}. Cannot proceed.`);
        }
        if (testBuffer.length > BINARY_PACKET_THRESHOLD) {
            if (Object.keys(currentPacketPayload).length > 0) {
                packetsJsonStrings.push(JSON.stringify(currentPacketPayload));
            } else {
                console.error(
                    `!!! ERROR: Parameter "${paramKey}" payload alone is too large (${testBuffer.length} bytes, Threshold: ${BINARY_PACKET_THRESHOLD}). Cannot send.`
                );
                throw new Error(
                    `Parameter ${paramKey} alone exceeds SET_SETDAT size limit (${BINARY_PACKET_THRESHOLD} bytes).`
                );
            }
            currentPacketPayload = { [paramKey]: paramValue };
            let singleParamJson = JSON.stringify(currentPacketPayload);
            let singleParamBuffer = buildAvrPacket(COMMAND_NAME, singleParamJson, 0, 0);
            if (singleParamBuffer.length > BINARY_PACKET_THRESHOLD) {
                console.error(
                    `!!! INTERNAL ERROR: Single parameter "${paramKey}" packet size (${singleParamBuffer.length}) still exceeds threshold after check. Aborting.`
                );
                throw new Error(
                    `Parameter ${paramKey} somehow exceeds size limit even when alone.`
                );
            }
        } else {
            currentPacketPayload[paramKey] = paramValue;
        }
    }
    if (Object.keys(currentPacketPayload).length > 0)
        packetsJsonStrings.push(JSON.stringify(currentPacketPayload));
    const totalPackets = packetsJsonStrings.length;
    if (totalPackets === 0) {
        console.warn("WARNING: No SET_SETDAT packets were generated after processing parameters!");
        return;
    }
    for (let i = 0; i < totalPackets; i++) {
        const jsonString = packetsJsonStrings[i];
        const packetBuffer = buildAvrPacket(COMMAND_NAME, jsonString, 0, 0);
        const label = `SET_SETDAT Pkt ${i + 1}/${totalPackets}`;
        try {
            await sendFunction(packetBuffer.toString("hex"), label, {
                addChecksum: false,
                expectAck: true,
                timeout: TRANSFER_CONFIG.timeouts.command,
            });
        } catch (error) {
            console.error(`!!! FAILED sending ${label}: ${error.message}`);
            throw new Error(`Failed to send ${label}. Aborting transfer.`);
        }
    }
    await delay(20);
}
function processFilterDataForTransfer(channelFilterData, multEqType, lookupChannelId) {
    let processedFilter = channelFilterData.filter || [];
    let processedFilterLV = channelFilterData.filterLV || [];
    const isSub = lookupChannelId.startsWith("SW") || lookupChannelId === "LFE";
    if (multEqType === "XT32") {
        try {
            processedFilter = convertXT32(processedFilter);
            processedFilterLV = convertXT32(processedFilterLV);
        } catch (decimationError) {
            console.error(
                `      ERROR during XT32 decimation for ${lookupChannelId}: ${decimationError.message}`
            );
            throw new Error(`XT32 decimation failed for ${lookupChannelId}`);
        }
        const expectedLength = isSub
            ? filterConfigs.xt32Sub.outputLength
            : filterConfigs.xt32Speaker.outputLength;
        if (processedFilter.length !== expectedLength) {
            console.warn(
                `      WARNING: Post-decimation filter length for XT32 channel ${lookupChannelId} is ${processedFilter.length}, expected ${expectedLength}.`
            );
        }
        if (processedFilterLV.length !== expectedLength) {
            console.warn(
                `      WARNING: Post-decimation filterLV length for XT32 channel ${lookupChannelId} is ${processedFilterLV.length}, expected ${expectedLength}.`
            );
        }
    } else {
        let expectedLength = 0;
        if (multEqType === "XT") {
            expectedLength = EXPECTED_NON_XT32_FLOAT_COUNTS.XT.speaker;
        } else if (multEqType === "MultEQ") {
            expectedLength = isSub
                ? EXPECTED_NON_XT32_FLOAT_COUNTS.MultEQ.sub
                : EXPECTED_NON_XT32_FLOAT_COUNTS.MultEQ.speaker;
        }
        if (expectedLength > 0) {
            if (processedFilter.length !== expectedLength) {
                console.warn(
                    `      WARNING: Input filter length for ${multEqType} channel ${lookupChannelId} is ${processedFilter.length}, expected ${expectedLength}. AVR might reject or truncate.`
                );
            }
            if (processedFilterLV.length !== expectedLength) {
                console.warn(
                    `      WARNING: Input filterLV length for ${multEqType} channel ${lookupChannelId} is ${processedFilterLV.length}, expected ${expectedLength}. AVR might reject or truncate.`
                );
            }
        } else {
            console.warn(
                `      Cannot determine expected length for non-XT32 type "${multEqType}". Sending filter as is.`
            );
        }
    }
    return {
        filter: processedFilter,
        filterLV: processedFilterLV,
    };
}
function generatePacketsForTransfer(coeffBuffers, channelConfig, tc, sr, channelByte) {
    const packets = [];
    let floatsProcessed = 0;
    const totalFloatsToSend = coeffBuffers.length;
    for (let packetIndex = 0; packetIndex < channelConfig.packetCount; packetIndex++) {
        const isFirstPacket = packetIndex === 0;
        const isLastPacket = packetIndex === channelConfig.packetCount - 1;
        let numFloatsInPacket;
        if (isFirstPacket) {
            numFloatsInPacket = channelConfig.firstPacketFloats;
        } else if (isLastPacket) {
            numFloatsInPacket = channelConfig.lastPacketFloats;
        } else {
            numFloatsInPacket = channelConfig.midPacketFloats;
        }
        if (numFloatsInPacket <= 0) {
            continue;
        }
        if (floatsProcessed >= totalFloatsToSend && numFloatsInPacket > 0) {
            console.warn(
                `WARN (Buffer Gen): Attempting to generate packet ${packetIndex} for ${numFloatsInPacket} float-buffers, but all ${totalFloatsToSend} already processed.`
            );
            break;
        }
        if (floatsProcessed + numFloatsInPacket > totalFloatsToSend) {
            console.warn(
                `WARN (Buffer Gen): Packet ${packetIndex} requests ${numFloatsInPacket} float-buffers, but only ${
                    totalFloatsToSend - floatsProcessed
                } remaining. Adjusting count.`
            );
            numFloatsInPacket = totalFloatsToSend - floatsProcessed;
            if (numFloatsInPacket <= 0) break;
        }
        const setCoefDT_Bytes = Buffer.from("5345545f434f45464454", "hex");
        let paramHeaderParts = [];
        if (isFirstPacket) {
            const channelByteHex = channelByte.toString(16).padStart(2, "0");
            const firstPacketInfoHex = tc + sr + channelByteHex + "00";
            paramHeaderParts.push(Buffer.from(firstPacketInfoHex, "hex"));
        }
        const payloadCoeffsSlice = coeffBuffers.slice(
            floatsProcessed,
            floatsProcessed + numFloatsInPacket
        );
        const currentPayloadBuffer = Buffer.concat(payloadCoeffsSlice);
        const paramsAndDataBuffer = Buffer.concat([...paramHeaderParts, currentPayloadBuffer]);
        const paramsAndDataLength = paramsAndDataBuffer.length;
        const sizeFieldBuffer = Buffer.alloc(2);
        sizeFieldBuffer.writeUInt16BE(paramsAndDataLength, 0);
        const commandHeaderBuffer = Buffer.concat([
            setCoefDT_Bytes,
            Buffer.from([0x00]),
            sizeFieldBuffer,
        ]);
        const totalPacketLengthField =
            1 + 2 + 1 + 1 + commandHeaderBuffer.length + paramsAndDataBuffer.length + 1;
        if (totalPacketLengthField > 0xffff) {
            throw new Error(
                `Calculated total packet length ${totalPacketLengthField} exceeds 65535 limit for packet ${packetIndex}.`
            );
        }
        const packetLengthBuffer = Buffer.alloc(2);
        packetLengthBuffer.writeUInt16BE(totalPacketLengthField, 0);
        const packetNumBuffer = Buffer.from([packetIndex & 0xff]);
        const lastSeqNumBuffer = Buffer.from([
            parseInt(channelConfig.lastSequenceNumField, 16) & 0xff,
        ]);
        const packetWithoutChecksum = Buffer.concat([
            Buffer.from([0x54]),
            packetLengthBuffer,
            packetNumBuffer,
            lastSeqNumBuffer,
            commandHeaderBuffer,
            paramsAndDataBuffer,
        ]);
        let checksum = 0;
        for (let i = 0; i < packetWithoutChecksum.length; i++) {
            checksum = (checksum + packetWithoutChecksum[i]) & 0xff;
        }
        const checksumBuffer = Buffer.from([checksum]);
        const finalPacketBuffer = Buffer.concat([packetWithoutChecksum, checksumBuffer]);
        packets.push({ bufferData: finalPacketBuffer });
        floatsProcessed += numFloatsInPacket;
    }
    if (floatsProcessed !== totalFloatsToSend) {
        console.warn(
            `WARN (Buffer Gen): generatePackets processed ${floatsProcessed} float-buffers, but expected ${totalFloatsToSend}.`
        );
    }
    return packets;
}
async function finalizeTransfer(dataType, sendFunction, coefWaitTime) {
    console.log("\nFinalizing filter transfer...");
    const finalizeTimeout = TRANSFER_CONFIG.timeouts.finalize;
    try {
        const finzCoefsHex = "540013000046494e5a5f434f4546530000006d";
        await sendFunction(finzCoefsHex, "FINZ_COEFS", {
            timeout: finalizeTimeout,
            expectAck: true,
            addChecksum: false,
        });
    } catch (e) {
        console.error(`!!! FAILED sending FINZ_COEFS: ${e.message}`);
        throw new Error("Failed to finalize coefficient processing (FINZ_COEFS).");
    }
    await delay(20);
    const finalFlagPayload = { AudyFinFlg: "Fin" };
    let finalFlagPacketBuffer;
    try {
        const finalFlagJsonString = JSON.stringify(finalFlagPayload);
        finalFlagPacketBuffer = buildAvrPacket("SET_SETDAT", finalFlagJsonString, 0, 0);
    } catch (buildError) {
        console.error(`!!! Error building final SET_SETDAT packet: ${buildError.message}`);
        throw new Error("Failed to build final SET_SETDAT packet.");
    }
    try {
        await sendFunction(finalFlagPacketBuffer.toString("hex"), "SET_AUDYFINFLG_FIN", {
            addChecksum: false,
            expectAck: true,
            timeout: TRANSFER_CONFIG.timeouts.command,
        });
    } catch (e) {
        console.error(`!!! FAILED setting final flag (AudyFinFlg=Fin): ${e.message}`);
        throw new Error("Failed to set final flag (AudyFinFlg=Fin).");
    }
    await delay(20);
    try {
        const exitAudmdHex = "5400130000455849545f4155444d440000006b";
        await sendFunction(exitAudmdHex, "EXIT_AUDMD", {
            timeout: TRANSFER_CONFIG.timeouts.command,
            expectAck: true,
            addChecksum: false,
        });
    } catch (e) {
        console.error(`!!! FAILED exiting calibration mode (EXIT_AUDMD): ${e.message}`);
        console.warn("   -> AVR might still be in calibration mode. Power cycle might be needed.");
    }
}
async function runCalibrationTransfer(targetIp, basePathForOcaSearch) {
    let client = null;
    let send = null;
    let audEnteredGlobal = false;
    try {
        console.log(`Starting calibration transfer process...`);
        console.log(`   Target AVR IP: ${targetIp}`);
        console.log(`   Searching for .oca files in: ${basePathForOcaSearch}`);
        const selectedOcaFile = await selectOcaFile(basePathForOcaSearch);
        let filterData;
        try {
            const fileContent = fs.readFileSync(selectedOcaFile, "utf8");
            filterData = JSON.parse(fileContent);
            if (
                typeof filterData.eqType === "undefined" ||
                !filterData.channels?.length ||
                filterData.lpfForLFE === undefined ||
                filterData.bassMode === undefined
            )
                throw new Error(
                    "Invalid OCA file format. Missing required fields (eqType, channels, lpfForLFE, bassMode)."
                );
            console.log(`Successfully read and parsed ${path.basename(selectedOcaFile)}.`);
        } catch (err) {
            throw new Error(`Error reading or parsing OCA file ${selectedOcaFile}: ${err.message}`);
        }
        let multEqType;
        switch (filterData.eqType) {
            case 0:
                multEqType = "MultEQ";
                break;
            case 1:
                multEqType = "XT";
                break;
            case 2:
                multEqType = "XT32";
                break;
            default:
                throw new Error(`Unknown eqType in .oca file: ${filterData.eqType}`);
        }
        try {
            await sendTelnetCommands(
                targetIp,
                23,
                filterData.lpfForLFE,
                filterData.bassMode,
                filterData.isNewModel,
                filterData.channels[0].xover
            );
        } catch (telnetError) {
            console.error(`Telnet setup failed: ${telnetError.message}`);
            console.warn(
                "Continuing transfer, but preset, LFE, L+M or bass extraction frequency settings might be compromised! Please double check these settings in the AVR menu."
            );
        }
        await delay(1000);
        client = await _connectToAVR(
            targetIp,
            AVR_CONTROL_PORT,
            TRANSFER_CONFIG.timeouts.connect,
            "transfer"
        );
        send = createCommandSender(client);
        console.log("Getting current AVR information and status...");
        const { activeChannels, dataType, coefWaitTime, avrStatus, rawChSetup } =
            await getAvrInfoAndStatusForTransfer(client);
        console.log(` AVR reported data type: ${dataType || "Unknown"}`);
        console.log(` AVR reported active channels: ${activeChannels.join(", ")}`);
        console.log(
            "Comparing calibration file (.oca) amp assignment/channel map with what AVR is reporting..."
        );
        if (!filterData || !filterData.channels || !Array.isArray(filterData.channels))
            throw new Error(`Internal Error: Invalid filterData during comparison.`);
        if (!activeChannels || !Array.isArray(activeChannels))
            throw new Error(
                `Could not retrieve valid active channel list from AVR for comparison.`
            );
        if (!avrStatus || !avrStatus.AssignBin || !avrStatus.AmpAssign)
            throw new Error(
                `Could not retrieve valid AssignBin/AmpAssign status from AVR for comparison.`
            );
        const ocaChannelNames = filterData.channels.map((ch) => ch.commandId);
        const normalizedOcaChannelIds = new Set(
            ocaChannelNames.map((id) => mapChannelIdForSetDat(id))
        );
        const normalizedAvrChannelIds = new Set(
            activeChannels.map((id) => mapChannelIdForSetDat(id))
        );
        const missingOnAvr = [];
        normalizedOcaChannelIds.forEach((ocaId) => {
            if (!normalizedAvrChannelIds.has(ocaId)) {
                const originalOcaName = ocaChannelNames.find(
                    (name) => mapChannelIdForSetDat(name) === ocaId
                );
                missingOnAvr.push(originalOcaName || ocaId);
            }
        });
        if (missingOnAvr.length > 0) {
            console.error(`\n--- CRITICAL CONFIGURATION MISMATCH ---`);
            console.error(
                `The following channels required by the OCA file are NOT active/configured on the AVR:`
            );
            console.error(`[${missingOnAvr.join(", ")}]`);
            console.error(`AVR currently reports active channels: [${activeChannels.join(", ")}]`);
            console.error(
                `Please correct the AVR speaker setup in its menu to match the OCA file, then retry.`
            );
            throw new Error(
                "Configuration mismatch: Channels missing on AVR requires manual correction."
            );
        }
        const missingInOca = [];
        normalizedAvrChannelIds.forEach((avrId) => {
            if (!normalizedOcaChannelIds.has(avrId)) {
                const originalAvrName = activeChannels.find(
                    (name) => mapChannelIdForSetDat(name) === avrId
                );
                missingInOca.push(originalAvrName || avrId);
            }
        });
        if (missingInOca.length > 0) {
            console.warn(`\n Warning: The AVR has active channels not present in the OCA file:`);
            console.warn(`[${missingInOca.join(", ")}]`);
            console.warn(
                `Settings for these extra channels will NOT be modified by this transfer.`
            );
        }
        if (
            filterData.ampAssignInfo &&
            typeof filterData.ampAssignInfo === "string" &&
            avrStatus.AssignBin &&
            typeof avrStatus.AssignBin === "string"
        ) {
            const ocaAssignBin = filterData.ampAssignInfo.trim();
            const avrAssignBin = avrStatus.AssignBin.trim();
            if (ocaAssignBin !== avrAssignBin) {
                console.warn(`\nWarning: Amplifier Assignment Map (AssignBin) Mismatch!`);
                console.warn(
                    `- The 'ampAssignInfo' in the OCA file does not match the AVR's current 'AssignBin'.`
                );
                console.warn(`OCA AssignBin: ${ocaAssignBin}`);
                console.warn(`AVR AssignBin: ${avrAssignBin}`);
                console.warn(
                    `This suggests AVR 'Amp assign' settings (pre-out, Zone 2, Bi-Amp, bass mode, etc.) may have changed since the '.oca' file was created.`
                );
                console.warn(
                    `Proceeding using the AVR's 'current' configuration but resolving the problem in the receiver's set up menu and generating a new configuration file is advised.`
                );
                console.warn(`Otherwise speakers may behave unexpectedly after transfer!`);
            } else {
                console.log(
                    " << Amplifier assignment map matches between .oca file and the AVR >>"
                );
            }
        } else {
            console.warn(
                `Note: Amplifier Assignment Map ('ampAssignInfo') not found or invalid in OCA file, or 'AssignBin' missing from AVR status. Comparison skipped.`
            );
            if (!filterData.ampAssignInfo || typeof filterData.ampAssignInfo !== "string")
                console.warn(`Reason: 'ampAssignInfo' missing/invalid in OCA file.`);
            if (!avrStatus.AssignBin || typeof avrStatus.AssignBin !== "string")
                console.warn(`Reason: 'AssignBin' missing/invalid in AVR status response.`);
            console.warn(
                `Proceeding using the AVR's *current* amplifier assignment reported during SET_SETDAT.`
            );
        }
        const hasGriffinLiteDSP = filterData.hasGriffinLiteDSP || false;
        const floorChannelIds = new Set(["FL", "C", "FR", "SLA", "SRA", "SBL", "SBR"]);
        const frontWideChannelIds = new Set(["FWL", "FWR"]);
        const subChannelIds = new Set(["SW1", "SW2", "SW3", "SW4"]);
        const floorChannels = [];
        const otherChannels = [];
        const frontWideChannels = [];
        const subChannels = [];
        for (const originalChannelId of activeChannels) {
            const mappedChannelId = mapChannelIdForSetDat(originalChannelId.toUpperCase());
            try {
                const channelByte = getChannelTypeByte(
                    mappedChannelId,
                    multEqType,
                    hasGriffinLiteDSP
                );
                const channelInfo = {
                    id: originalChannelId,
                    mappedId: mappedChannelId,
                    byte: channelByte,
                };
                if (floorChannelIds.has(channelInfo.mappedId)) floorChannels.push(channelInfo);
                else if (subChannelIds.has(channelInfo.mappedId)) subChannels.push(channelInfo);
                else if (frontWideChannelIds.has(channelInfo.mappedId))
                    frontWideChannels.push(channelInfo);
                else otherChannels.push(channelInfo);
            } catch (byteError) {
                console.warn(
                    `WARNING: Could not get channel byte for ${originalChannelId}. Skipping channel. Error: ${byteError.message}`
                );
            }
        }
        const sortByByte = (a, b) => a.byte - b.byte;
        floorChannels.sort(sortByByte);
        otherChannels.sort(sortByByte);
        frontWideChannels.sort(sortByByte);
        subChannels.sort(sortByByte);
        const channelsToSendSorted = [
            ...floorChannels,
            ...otherChannels,
            ...frontWideChannels,
            ...subChannels,
        ];
        audEnteredGlobal = false;
        try {
            const enterAudyHex = "5400130000454e5445525f4155445900000077";
            await send(enterAudyHex, "ENTER_AUDY", {
                timeout: TRANSFER_CONFIG.timeouts.enterCalibration,
                expectAck: true,
                addChecksum: false,
            });
            audEnteredGlobal = true;
        } catch (e) {
            console.error(`   FAILED to enter calibration mode: ${e.message}`);
            throw new Error(`Failed to enter calibration mode. Reason: ${e.message}`);
        }
        await sendSetDatCommand(
            send,
            avrStatus,
            rawChSetup,
            filterData,
            channelsToSendSorted,
            multEqType,
            hasGriffinLiteDSP
        );
        if (dataType?.toLowerCase().startsWith("fixed")) {
            try {
                await delay(coefWaitTime.Init * 3);
                const initCoefsHex = "5400130000494e49545f434f4546530000006a";
                await send(initCoefsHex, "INIT_COEFS", {
                    timeout: 10000,
                    expectAck: true,
                    addChecksum: false,
                });
                await delay(coefWaitTime.Init);
            } catch (e) {
                console.error(`!!! FAILED sending INIT_COEFS: ${e.message}`);
                throw new Error("Failed to initialize coefficients (INIT_COEFS).");
            }
        }
        if (channelsToSendSorted.length === 0 && activeChannels.length > 0) {
            console.error(
                "Error: No channels available for sending after byte sorting phase. Check warnings above."
            );
            throw new Error("Failed to determine send order for any active channels.");
        } else if (channelsToSendSorted.length === 0) {
            console.warn("No active channels to send coefficient data for.");
        } else {
            let converterFuncToBuffer;
            if (dataType?.toLowerCase() === "float") {
                converterFuncToBuffer = floatToBufferLE;
            } else {
                converterFuncToBuffer = (f) => fixed32IntToBufferLE(javaFloatToFixed32bits(f));
            }
            const allProcessedData = new Map();
            for (const originalChannelId of activeChannels) {
                const lookupChannelId = mapChannelIdForSetDat(originalChannelId.toUpperCase());
                const channelFilterData = filterData.channels.find(
                    (ch) => mapChannelIdForSetDat(ch.commandId.toUpperCase()) === lookupChannelId
                );
                if (
                    !channelFilterData ||
                    !channelFilterData.filter?.length ||
                    !channelFilterData.filterLV?.length
                ) {
                    console.warn(
                        `Skipping pre-processing for ${originalChannelId}: Missing/incomplete data in OCA file.`
                    );
                    continue;
                }
                try {
                    const processed = processFilterDataForTransfer(
                        channelFilterData,
                        multEqType,
                        lookupChannelId
                    );
                    allProcessedData.set(originalChannelId, processed);
                } catch (processingError) {
                    console.error(
                        `Error pre-processing filter data for ${lookupChannelId}: ${processingError.message}`
                    );
                    console.warn(
                        `Skipping filter transfer for channel ${originalChannelId} due to pre-processing error.`
                    );
                }
            }
            for (const tc of TRANSFER_CONFIG.targetCurves) {
                const curveName = tc === "01" ? "Reference" : "Flat";
                console.log(`\nUploading ${curveName} mode filters =>`);
                for (const channelInfo of channelsToSendSorted) {
                    const originalChannelId = channelInfo.id;
                    const mappedChannelId = channelInfo.mappedId;
                    if (!allProcessedData.has(originalChannelId)) {
                        console.warn(
                            `--- Skipping Channel: ${originalChannelId} (No pre-processed data available) ---`
                        );
                        continue;
                    }
                    console.log(` >> Channel: ${originalChannelId}`);
                    const processedDataForChannel = allProcessedData.get(originalChannelId);
                    const coeffsToSend =
                        tc === "01"
                            ? processedDataForChannel.filter
                            : processedDataForChannel.filterLV;
                    try {
                        await sendCoeffsForAllSampleRates(
                            tc,
                            coeffsToSend,
                            curveName,
                            originalChannelId,
                            mappedChannelId,
                            multEqType,
                            hasGriffinLiteDSP,
                            converterFuncToBuffer,
                            send
                        );
                    } catch (error) {
                        console.error(
                            `!!! FAILED sending filters for ${originalChannelId} - Target Curve ${curveName}.`
                        );
                        console.error(`Error details: ${error.message}`);
                        throw new Error(
                            `Transfer failed for channel ${originalChannelId}, Target Curve ${curveName}.`
                        );
                    }
                    await delay(20);
                }
                await delay(100);
            }
        }
        await finalizeTransfer(dataType, send, coefWaitTime);
        console.log("\n << All calibration settings were transferred successfully! >>");
        console.log(
            `Your receiver "${cachedAvrConfig?.targetModelName || targetIp}" is now updated.`
        );
        console.log(`\nReminder:`);
        console.log(` - Use 'Flat' for normal listening levels.`);
        console.log(` - Use 'Reference' for low listening levels.`);
        console.log(` - Optimization assumes 'Dynamic EQ' and Dynamic Volume are both off.`);
    } catch (err) {
        console.error("\n---!!! CALIBRATION TRANSFER FAILED !!!---");
        console.error("   Error:", err.message);
        if (audEnteredGlobal && client && send && !client.destroyed) {
            console.warn("\nAttempting to exit calibration mode due to error...");
            try {
                await send("5400130000455849545f4155444d440000006b", "EXIT_AUDMD_ON_ERROR", {
                    expectAck: true,
                    addChecksum: false,
                    timeout: 3000,
                });
                console.warn("Calibration mode exited successfully after error.");
            } catch (exitErr) {
                console.error(
                    `!!! FAILED to exit calibration mode during error cleanup: ${exitErr.message}`
                );
                console.error(`!!! You may need to power-cycle your AVR manually!`);
            }
        } else {
            let reason = "";
            if (!audEnteredGlobal) reason = "Calibration mode not successfully entered.";
            else if (!client || client.destroyed)
                reason = "Connection already closed or not established.";
            else if (!send) reason = "Command sender not available.";
            console.warn(
                `\nCannot attempt automatic exit from calibration mode. Reason: ${reason}`
            );
            console.warn("If the AVR is stuck, please power-cycle it manually.");
        }
        throw err;
    } finally {
        if (client && !client.destroyed) {
            console.log("\nClosing AVR connection...");
            try {
                client.end(() => {});
                await delay(500);
                if (client && !client.destroyed) {
                    console.warn("Connection did not close gracefully, forcing destroy.");
                    client.destroy();
                }
            } catch (closeErr) {
                console.error("Error during connection closing:", closeErr.message);
                if (client && !client.destroyed) {
                    console.warn("Forcing connection destroy after close error.");
                    client.destroy();
                }
            }
        }
    }
}
async function sendCoeffsForAllSampleRates(
    tc,
    coeffs,
    curveName,
    originalChannelId,
    mappedChannelId,
    multEqType,
    hasGriffinLiteDSP,
    converterFuncToBuffer,
    sendFunction
) {
    if (!coeffs || !Array.isArray(coeffs) || coeffs.length === 0) {
        console.warn(
            `Skipping send for ${originalChannelId}/${curveName}: zero or invalid coefficients provided.`
        );
        return;
    }
    let channelConfig, channelByte;
    try {
        channelConfig = buildPacketConfig(coeffs.length);
        if (!channelConfig || typeof channelConfig.lastSequenceNumField === "undefined") {
            throw new Error(`buildPacketConfig returned invalid object.`);
        }
        channelByte = getChannelTypeByte(mappedChannelId, multEqType, hasGriffinLiteDSP);
    } catch (err) {
        console.error(
            `Error configuring packets for ${originalChannelId} (${curveName}): ${err.message}.`
        );
        throw err;
    }
    let coeffBuffers;
    try {
        coeffBuffers = coeffs.map(converterFuncToBuffer);
    } catch (conversionError) {
        console.error(
            `Error converting coefficients to buffers for ${originalChannelId} (${curveName}): ${conversionError.message}.`
        );
        throw conversionError;
    }
    for (const sr of TRANSFER_CONFIG.sampleRates) {
        let packets;
        try {
            packets = generatePacketsForTransfer(coeffBuffers, channelConfig, tc, sr, channelByte);
        } catch (packetGenError) {
            console.error(
                `Error generating packets for SR ${sr} (${originalChannelId}/${curveName}): ${packetGenError.message}.`
            );
            throw packetGenError;
        }
        if (!packets || packets.length === 0) {
            console.warn(
                `WARNING: No packets generated for SR ${sr} (${originalChannelId}/${curveName}). Skipping SR.`
            );
            continue;
        }
        for (let i = 0; i < packets.length; i++) {
            const packetBufferToSend = packets[i].bufferData;
            if (!Buffer.isBuffer(packetBufferToSend)) {
                console.error(
                    `!!! CRITICAL: Packet ${
                        i + 1
                    } for ${originalChannelId}/${curveName}/SR${sr} is not a Buffer.`
                );
                throw new Error("Packet generation failed to produce a Buffer.");
            }
            const packetLabel = `Coef Pkt ${i + 1}/${
                packets.length
            } (${originalChannelId} ${curveName} SR${sr})`;
            try {
                await sendFunction(packetBufferToSend, packetLabel, {
                    expectAck: true,
                    addChecksum: false,
                    timeout: TRANSFER_CONFIG.timeouts.command,
                });
            } catch (err) {
                console.error(`!!! FAILED sending ${packetLabel}: ${err.message}`);
                throw err;
            }
        }
        await delay(20);
    }
}
function bufferToFloatArray(buffer) {
    if (!buffer || buffer.length === 0) return [];
    const floatCount = buffer.length / BYTES_PER_FLOAT;
    const floats = new Array(floatCount);
    for (let i = 0; i < floatCount; i++) {
        const offset = i * BYTES_PER_FLOAT;
        floats[i] = buffer.readFloatLE(offset);
    }
    return floats;
}
function fixed32BufferToFloatArray(buffer) {
    if (!buffer || buffer.length === 0) return [];
    const intCount = buffer.length / BYTES_PER_FLOAT;
    const floats = new Array(intCount);
    const divisor = 2147483648.0; // 2^31
    for (let i = 0; i < intCount; i++) {
        const offset = i * BYTES_PER_FLOAT;
        const intValue = buffer.readInt32LE(offset);
        floats[i] = intValue / divisor;
    }
    return floats;
}
function parseIncomingPacket(buffer) {
    if (buffer.length < 5 || (buffer[0] !== 0x54 && buffer[0] !== 0x52)) return null;
    const totalLength = buffer.readUInt16BE(1);
    if (buffer.length < totalLength) return null;
    const packetData = buffer.slice(0, totalLength);
    const receivedChecksum = packetData[packetData.length - 1];
    let calculatedChecksum = 0;
    for (let i = 0; i < packetData.length - 1; i++)
        calculatedChecksum = (calculatedChecksum + packetData[i]) & 0xff;
    if (receivedChecksum !== calculatedChecksum) {
        console.warn(
            `Checksum mismatch on incoming packet. Discarding. (Expected: ${calculatedChecksum}, Got: ${receivedChecksum})`
        );
        return { totalLength };
    }
    const currentSeq = packetData.readUInt8(3);
    const lastSeq = packetData.readUInt8(4);
    const commandNameEnd = packetData.indexOf(0x00, 5);
    if (commandNameEnd === -1) {
        console.warn("Malformed packet: No command name terminator found.");
        return { totalLength };
    }
    if (packetData.length < commandNameEnd + 3) {
        console.warn("Malformed packet: Too short for parameter length field.");
        return { totalLength };
    }
    const paramLength = packetData.readUInt16BE(commandNameEnd + 1);
    const payloadStart = commandNameEnd + 3;
    if (payloadStart + paramLength > totalLength - 1) {
        console.warn("Malformed packet: Parameter length exceeds packet boundary.");
        return { totalLength };
    }
    const payload = packetData.slice(payloadStart, payloadStart + paramLength);
    return { currentSeq, lastSeq, payload, totalLength };
}
async function runMeasurementProcess() {
    let client = null;
    let mModeEntered = false;
    const targetIp = cachedAvrConfig.ipAddress;
    const detectedChannels = JSON.parse(JSON.stringify(cachedAvrConfig.detectedChannels));
    const subwooferCount = cachedAvrConfig.subwooferNum;
    try {
        console.log(`\nStarting measurement process for ${targetIp}...`);
        const { totalPositions } = await inquirer.prompt([
            {
                type: "input",
                name: "totalPositions",
                message: "How many different microphone positions do you want to measure (1-25)?",
                default: 1,
                validate: (input) => {
                    const num = parseInt(input);
                    return num >= 1 && num <= 25 ? true : "Please enter a number between 1 and 25.";
                },
            },
        ]);
        if (totalPositions > 1)
            console.log(
                "Using a swivel mic stand is highly recommended for measuring multiple mic positions."
            );
        let startDelayEnabled = false;
        let startDelaySeconds = 0;
        const { enableDelayChoice } = await inquirer.prompt([
            {
                type: "confirm",
                name: "enableDelayChoice",
                message:
                    "Do you want to add a delay before sweeps start at each microphone position (to allow you to leave the room)?",
                default: false,
            },
        ]);
        if (enableDelayChoice) {
            startDelayEnabled = true;
            const { delaySecondsInput } = await inquirer.prompt([
                {
                    type: "input",
                    name: "delaySecondsInput",
                    message: "Enter delay in seconds (e.g., 5 to 30):",
                    default: 10,
                    validate: (input) => {
                        const num = parseInt(input);
                        return num >= 1 && num <= 60
                            ? true
                            : "Please enter a number between 1 and 60 seconds.";
                    },
                },
            ]);
            startDelaySeconds = parseInt(delaySecondsInput);
        }
        const { confirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "confirm",
                message: `This will start a measurement sequence for ${totalPositions} position(s). Please ENSURE the CALIBRATION MICROPHONE that came with the unit is PLUGGED IN the front panel of the AV receiver. Continue?`,
                default: true,
            },
        ]);
        if (!confirm) {
            console.log("Measurement process cancelled by user.");
            return;
        }
        console.log("\nConnecting to AVR for taking measurements...");
        client = await _connectToAVR(
            targetIp,
            AVR_CONTROL_PORT,
            MEASUREMENT_CONFIG.timeouts.connect,
            "measurement"
        );
        const send = createCommandSender(client);
        console.log("Getting AVR data type information...");
        let avrDataType = "float";
        try {
            const infoJson = await _sendRawAndParseJsonHelper(
                client,
                "54001300004745545f415652494e460000006c",
                "GET_AVRINF",
                MEASUREMENT_CONFIG.timeouts.command,
                8 * 1024,
                "Measurement"
            );
            if (infoJson?.DType) {
                avrDataType = infoJson.DType.toLowerCase();
                console.log(` -> AVR reported data type: ${infoJson.DType}`);
            } else {
                console.warn(
                    " -> Could not determine AVR data type from response. Assuming 'float'."
                );
            }
        } catch (infoError) {
            console.error(
                `Error getting AVR info: ${infoError.message}. Assuming 'float' data type.`
            );
        }
        if (avrDataType.startsWith("fixed") && subwooferCount > 2) {
            throw new Error(
                `Your AVR model supports a maximum of 2 subwoofers. Your configuration reports ${subwooferCount} subwoofers. The measurement process cannot continue. Please correct your AVR settings and re-run the configuration step.`
            );
        }
        let channelsToMeasureInOrder = [...detectedChannels];
        if (avrDataType.startsWith("fixed")) {
            console.log(
                "AVR has 'fixedA' data type. Re-ordering channels for measurement based on required sequence."
            );
            const detectedChannelIdsSet = new Set(detectedChannels.map((ch) => ch.commandId));
            const reorderedChannels = [];
            for (const channelId of MEASUREMENT_CHANNEL_ORDER_FIXEDA) {
                if (detectedChannelIdsSet.has(channelId)) {
                    const channelObject = detectedChannels.find((ch) => ch.commandId === channelId);
                    if (channelObject) {
                        reorderedChannels.push(channelObject);
                        detectedChannelIdsSet.delete(channelId);
                    }
                }
            }
            if (detectedChannelIdsSet.size > 0) {
                console.warn(
                    `[Warning] The following detected channels are not in the standard 'fixedA' order list and will be measured last: ${[
                        ...detectedChannelIdsSet,
                    ].join(", ")}`
                );
                for (const leftoverId of detectedChannelIdsSet) {
                    const channelObject = detectedChannels.find(
                        (ch) => ch.commandId === leftoverId
                    );
                    if (channelObject) reorderedChannels.push(channelObject);
                }
            }
            channelsToMeasureInOrder = reorderedChannels;
            console.log(
                ` -> New measurement order: [${channelsToMeasureInOrder
                    .map((ch) => ch.commandId)
                    .join(", ")}]`
            );
        } else {
            console.log(
                "AVR has 'float' data type. Using default measurement order from configuration."
            );
        }
        const isFixedA_MultiSub = avrDataType.startsWith("fixed") && subwooferCount > 1;
        if (isFixedA_MultiSub) {
            console.log("\n---!!! IMPORTANT: MANUAL SUBWOOFER CABLE SWAP REQUIRED !!!---");
            console.log(
                "This AVR model requires a manual cable swap to measure each one of the multiple subwoofers separately."
            );
            console.log("You will be prompted when to swap the cables during the process.");
            console.log("-----------------------------------------------------------------");
            await delay(4000);
        }
        console.log("Entering measurement mode...");
        const enterAudyHex = "5400130000454e5445525f4155445900000077";
        await send(enterAudyHex, "ENTER_AUDY", {
            timeout: MEASUREMENT_CONFIG.timeouts.enterCalibration,
            expectAck: true,
            addChecksum: false,
        });
        mModeEntered = true;
        const avrInitDelay = 15000;
        console.log(
            `AVR is initializing for measurement mode, please wait... (this will take ${
                avrInitDelay / 1000
            } seconds)`
        );
        await delay(avrInitDelay);
        console.log("AVR should now be ready.");
        const allPositionsData = {};
        const allChannelReports = new Map();
        let currentPosition = 1;
        while (currentPosition <= totalPositions) {
            let positionMeasurementSatisfactory = false;
            while (!positionMeasurementSatisfactory) {
                allPositionsData[`position${currentPosition}`] = {};
                for (const [_channelId, positionReportsMap] of allChannelReports) {
                    positionReportsMap.delete(currentPosition - 1);
                }
                console.log(
                    `\n=============== Starting Measurement for MIC POSITION ${currentPosition} / ${totalPositions} ===============`
                );
                const micPromptMessage =
                    currentPosition === 1
                        ? `Please place the calibration microphone at the MAIN LISTENING POSITION, its tip AT EAR LEVEL and POINTING directly UP! Then press Enter to begin.`
                        : `Please move the microphone to the next position (${currentPosition}) and press Enter to continue.`;
                const { ready } = await inquirer.prompt([
                    { type: "confirm", name: "ready", message: micPromptMessage, default: true },
                ]);
                if (!ready) throw new Error("User cancelled measurement process.");
                if (startDelayEnabled && startDelaySeconds > 0) {
                    console.log(
                        `\nStarting measurement sequence in ${startDelaySeconds} seconds... Please leave the room if desired.`
                    );
                    for (let i = startDelaySeconds; i > 0; i--) {
                        process.stdout.write(`  ${i}... `);
                        await delay(1000);
                    }
                    console.log(" Go!");
                }
                if (isFixedA_MultiSub) {
                    const subChannels = channelsToMeasureInOrder.filter((c) =>
                        c.commandId.startsWith("SW")
                    );
                    const nonSubChannels = channelsToMeasureInOrder.filter(
                        (c) => !c.commandId.startsWith("SW")
                    );
                    let individualSubScratchpadOffset = 0;
                    const firstSubInList = subChannels.length > 0 ? subChannels[0] : null;
                    let channelsForFirstMainCycle = [...nonSubChannels];
                    if (firstSubInList) {
                        channelsForFirstMainCycle.push(firstSubInList);
                        console.log(
                            `\n--- Preparing to measure SPEAKERS and Subwoofer #${1} (${
                                firstSubInList.commandId
                            }) for Position ${currentPosition} ---`
                        );
                        await inquirer.prompt([
                            {
                                type: "confirm",
                                name: "readySw1",
                                message: `Please ensure the cable for ${firstSubInList.commandId} is connected to the 'SW1' sub pre-out on the rear panel.\nPress Enter to continue.`,
                                default: true,
                            },
                        ]);
                    } else if (nonSubChannels.length > 0) {
                        console.log(
                            "\n--- Starting Measurement Cycle for SPEAKERS (Non-Subwoofers) ---"
                        );
                    }
                    if (channelsForFirstMainCycle.length > 0) {
                        await sendSetPositionCommand(
                            send,
                            currentPosition,
                            channelsForFirstMainCycle,
                            subwooferCount
                        );
                        await delay(500);
                        for (const channel of channelsForFirstMainCycle) {
                            console.log(
                                `\n----- Sending sweeps for: ${channel.commandId} (Pos ${currentPosition}) -----`
                            );
                            const measurementReport = await startChannelMeasurement(
                                client,
                                channel.commandId
                            );
                            if (!allChannelReports.has(channel.commandId))
                                allChannelReports.set(channel.commandId, new Map());
                            allChannelReports
                                .get(channel.commandId)
                                .set(currentPosition - 1, measurementReport);
                            console.log(
                                ` -> Measurement for channel ${channel.commandId} acknowledged by AVR.`
                            );
                            if (
                                (channel.commandId === "FL" || channel.commandId === "FR") &&
                                currentPosition === 1 &&
                                (!firstSubInList ||
                                    channel.commandId === firstSubInList.commandId) &&
                                measurementReport.Distance !== undefined
                            ) {
                                console.log(
                                    `  -> Reported distance from ${channel.commandId} speaker to microphone tip: ${measurementReport.Distance} cm`
                                );
                            }
                            await delay(1000);
                        }
                        console.log("\n--- Retrieving impulse response data for this cycle ---");
                        for (const channel of channelsForFirstMainCycle) {
                            console.log(
                                `\n----- Fetching impulse response for: ${channel.commandId} (Pos ${currentPosition}) -----`
                            );
                            const impulseResponseBuffer = await getChannelImpulseResponse(
                                client,
                                channel.commandId
                            );
                            let impulseFloats = fixed32BufferToFloatArray(impulseResponseBuffer);
                            const report = allChannelReports
                                .get(channel.commandId)
                                ?.get(currentPosition - 1);
                            const responseCoef = report?.ResponseCoef;
                            if (typeof responseCoef === "number" && responseCoef !== 1) {
                                for (let i = 0; i < impulseFloats.length; i++)
                                    impulseFloats[i] *= responseCoef;
                            }
                            allPositionsData[`position${currentPosition}`][channel.commandId] =
                                impulseFloats;
                            console.log(
                                ` -> Successfully retrieved ${impulseFloats.length} samples for ${channel.commandId}.`
                            );
                            await delay(500);
                        }
                    }
                    const otherSubChannels = subChannels.slice(1);
                    for (const subChannel of otherSubChannels) {
                        const channelIdToSaveAs = subChannel.commandId;
                        const subNumber = channelIdToSaveAs.replace("SW", "");
                        console.log(
                            `\n----- MANUAL ACTION REQUIRED for Subwoofer ${subNumber} (${channelIdToSaveAs}) -----`
                        );
                        await inquirer.prompt([
                            {
                                type: "confirm",
                                name: "readyToSwap",
                                message: `Please UNPLUG the current cable from the 'SW1' sub pre-out on the rear panel of the AVR and PLUG IN the cable for subwoofer #${subNumber} (${channelIdToSaveAs}).\n  Press Enter when you have swapped RCA cables.`,
                                default: true,
                            },
                        ]);
                        const positionToSendToAvrForSub = 20 + individualSubScratchpadOffset;
                        individualSubScratchpadOffset++;
                        console.log(
                            ` -> Using temporary position ${positionToSendToAvrForSub} for ${channelIdToSaveAs}...`
                        );
                        const sw1ForCycleObject = { commandId: "SW1" };
                        const subCycleChannelsToTellAvr = [...nonSubChannels, sw1ForCycleObject];
                        await sendSetPositionCommand(
                            send,
                            positionToSendToAvrForSub,
                            subCycleChannelsToTellAvr,
                            subwooferCount
                        );
                        await delay(500);
                        console.log(
                            ` -> Sweeping all speakers for this sub-cycle (non-sub responses ignored)...`
                        );
                        for (const ch of nonSubChannels) {
                            await startChannelMeasurement(client, ch.commandId);
                        }
                        console.log(
                            ` -> Sweeping ${channelIdToSaveAs} via SW1 input (AVR sees SW1)...`
                        );
                        const subMeasurementReport = await startChannelMeasurement(client, "SW1");
                        if (!allChannelReports.has(channelIdToSaveAs))
                            allChannelReports.set(channelIdToSaveAs, new Map());
                        allChannelReports
                            .get(channelIdToSaveAs)
                            .set(currentPosition - 1, subMeasurementReport);
                        console.log(` -> Measurement sequence for ${channelIdToSaveAs} complete.`);
                        await delay(1000);
                        console.log(
                            `\n----- Fetching impulse response for: ${channelIdToSaveAs} (AVR saw SW1) -----`
                        );
                        const impulseResponseBuffer = await getChannelImpulseResponse(
                            client,
                            "SW1"
                        );
                        let impulseFloats = fixed32BufferToFloatArray(impulseResponseBuffer);
                        const subResponseCoef = subMeasurementReport?.ResponseCoef;
                        if (typeof subResponseCoef === "number" && subResponseCoef !== 1) {
                            for (let i = 0; i < impulseFloats.length; i++)
                                impulseFloats[i] *= subResponseCoef;
                        }
                        allPositionsData[`position${currentPosition}`][channelIdToSaveAs] =
                            impulseFloats;
                        console.log(
                            ` -> Successfully retrieved ${impulseFloats.length} samples for ${channelIdToSaveAs}.`
                        );
                        await delay(500);
                    }
                    if (subChannels.length > 0) {
                        console.log(`\n----- MANUAL ACTION REQUIRED: Restore Cabling -----`);
                        await inquirer.prompt([
                            {
                                type: "confirm",
                                name: "ready",
                                message: `All measurements for position ${currentPosition} are complete.\nPlease restore the original subwoofer cabling (plug the SW1 cable back into the 'SW1' sub pre-out on the rear panel).\nThis is important for the next position or for finishing. Press Enter when ready.`,
                                default: true,
                            },
                        ]);
                    }
                } else {
                    await sendSetPositionCommand(
                        send,
                        currentPosition,
                        channelsToMeasureInOrder,
                        subwooferCount
                    );
                    await delay(500);
                    console.log("\n--- Starting Measurement Cycle ---");
                    for (const channel of channelsToMeasureInOrder) {
                        console.log(`\n----- Sending sweeps for: ${channel.commandId} -----`);
                        const measurementReport = await startChannelMeasurement(
                            client,
                            channel.commandId
                        );
                        if (!allChannelReports.has(channel.commandId))
                            allChannelReports.set(channel.commandId, new Map());
                        allChannelReports
                            .get(channel.commandId)
                            .set(currentPosition - 1, measurementReport);
                        console.log(
                            ` -> Measurement for channel ${channel.commandId} acknowledged by AVR.`
                        );
                        if (
                            channel.commandId === "FL" &&
                            currentPosition === 1 &&
                            measurementReport.Distance !== undefined
                        ) {
                            console.log(
                                `  -> Reported distance from Front Left (FL) speaker to microphone tip: ${measurementReport.Distance} cm`
                            );
                        }
                        await delay(1000);
                    }
                    console.log(
                        "\n--- All speakers/subs for this position are complete. Starting data retrieval ---"
                    );
                    for (const channel of channelsToMeasureInOrder) {
                        console.log(
                            `\n----- Fetching impulse response for: ${channel.commandId} -----`
                        );
                        const impulseResponseBuffer = await getChannelImpulseResponse(
                            client,
                            channel.commandId
                        );
                        const impulseFloats = avrDataType.startsWith("fixed")
                            ? fixed32BufferToFloatArray(impulseResponseBuffer)
                            : bufferToFloatArray(impulseResponseBuffer);
                        const report = allChannelReports
                            .get(channel.commandId)
                            ?.get(currentPosition - 1);
                        const responseCoef = report?.ResponseCoef;
                        if (typeof responseCoef === "number" && responseCoef !== 1) {
                            for (let i = 0; i < impulseFloats.length; i++)
                                impulseFloats[i] *= responseCoef;
                        }
                        if (
                            impulseFloats.length > 0 &&
                            !impulseFloats.some((sample) => sample !== 0)
                        )
                            console.warn(
                                `WARNING: Received an all-zero (silent) response for ${channel.commandId}. The channel may be disconnected or muted. MEASUREMENT IS INVALID!`
                            );
                        allPositionsData[`position${currentPosition}`][channel.commandId] =
                            impulseFloats;
                        console.log(
                            ` -> Successfully retrieved ${impulseFloats.length} samples for ${channel.commandId}.`
                        );
                        await delay(500);
                    }
                }
                const { satisfactionChoice } = await inquirer.prompt([
                    {
                        type: "list",
                        name: "satisfactionChoice",
                        message: `Measurements for Position ${currentPosition} complete. Are you satisfied?`,
                        choices: [
                            { name: "Yes, proceed to next position (or finish)", value: "yes" },
                            { name: "No, repeat measurements for this position", value: "no" },
                            { name: "Cancel entire measurement process", value: "cancel" },
                        ],
                        loop: false,
                    },
                ]);
                if (satisfactionChoice === "yes") {
                    positionMeasurementSatisfactory = true;
                } else if (satisfactionChoice === "no") {
                    console.log(
                        `\nDiscarding measurements for Position ${currentPosition} and preparing to re-measure.`
                    );
                } else {
                    throw new Error("User cancelled measurement process during review.");
                }
            }
            if (positionMeasurementSatisfactory) {
                currentPosition++;
            }
        }
        if (Object.keys(allPositionsData).length > 0) {
            const restructuredData = { detectedChannels: [] };
            for (const channel of detectedChannels) {
                const channelId = channel.commandId;
                const channelData = { commandId: channelId };
                channelData.responseData = {};
                for (let pos = 1; pos <= totalPositions; pos++) {
                    const originalKey = `position${pos}`;
                    const newKey = (pos - 1).toString();
                    if (
                        allPositionsData[originalKey] &&
                        typeof allPositionsData[originalKey][channelId] !== "undefined"
                    ) {
                        const floatArray = allPositionsData[originalKey][channelId];
                        channelData.responseData[newKey] = floatArray;
                    } else if (allPositionsData[originalKey]) {
                        channelData.responseData[newKey] = [];
                        console.warn(
                            `[ADY Save] No measurement data found for ${channelId} at logical position ${pos}. Saving empty array.`
                        );
                    }
                }
                if (Object.keys(channelData.responseData).length > 0 || totalPositions === 0) {
                    restructuredData.detectedChannels.push(channelData);
                } else {
                    console.warn(
                        `[ADY Save] Channel ${channelId} had no data for any completed positions. Not saving to file.`
                    );
                }
            }
            if (restructuredData.detectedChannels.length > 0) {
                const now = new Date();
                const timestamp = now
                    .toISOString()
                    .replace(/[-:]/g, "")
                    .replace(/\..+/, "")
                    .replace("T", "_");
                const adyFilename = `Acoustica_measurement_${
                    Object.keys(allPositionsData).length
                }_mic_positions_${timestamp}.ady`;
                const adyFilepath = path.join(APP_BASE_PATH, adyFilename);
                console.log(`\nSaving all measurements to ${adyFilename}...`);
                const adyJsonString = JSON.stringify(restructuredData, null, 2);
                await fsPromises.writeFile(adyFilepath, adyJsonString, "utf8");
                console.log(`Success! File saved to: ${adyFilepath}`);
                console.log(
                    `You can upload and use these measurements in REW using 'Extract measurements' button within the optimizer (menu option 3).`
                );
            } else {
                console.warn(
                    "\nNo valid measurement data was collected for any channel. No file was saved!"
                );
            }
        } else {
            console.warn("\nNo measurement data was retrieved and no file was saved!");
        }
    } catch (err) {
        console.error("\n---!!! MEASUREMENT PROCESS FAILED !!!---");
        console.error("Error:", err.message);
        throw err;
    } finally {
        if (mModeEntered && client && !client.destroyed) {
            console.log("\nExiting measurement mode...");
            try {
                const send = createCommandSender(client);
                const exitAudmdHex = "5400130000455849545f4155444d440000006b";
                await send(exitAudmdHex, "EXIT_AUDMD", {
                    expectAck: true,
                    addChecksum: false,
                    timeout: 3000,
                });
                console.log(" -> Mode exited successfully.");
            } catch (exitErr) {
                console.error(
                    `!!! FAILED to exit calibration mode during cleanup: ${exitErr.message}`
                );
                console.error(`!!! You may need to power-cycle your AVR manually!`);
            }
        }
        if (client && !client.destroyed) {
            console.log("Closing AVR connection...");
            client.destroy();
        }
    }
}
async function sendSetPositionCommand(sendFunction, position, detectedChannels, subwooferCount) {
    const detectedChannelIds = new Set(detectedChannels.map((ch) => ch.commandId));
    const channelsForPayload = [];
    for (const channelId of MEASUREMENT_CHANNEL_ORDER_FIXEDA) {
        if (detectedChannelIds.has(channelId)) {
            channelsForPayload.push(channelId);
        }
    }
    for (const detectedId of detectedChannelIds) {
        if (!channelsForPayload.includes(detectedId)) {
            console.warn(
                `[Warning] Detected channel "${detectedId}" is not in the known order list. Appending to the end.`
            );
            channelsForPayload.push(detectedId);
        }
    }
    console.log(` -> Channels to be measured by AVR: [${channelsForPayload.join(", ")}]`);
    const payloadObject = { Position: parseInt(position, 10), ChSetup: channelsForPayload };
    let jsonString = JSON.stringify(payloadObject);
    jsonString += "}";
    const packet = buildAvrPacket("SET_POSNUM", jsonString);
    await sendFunction(packet.toString("hex"), "SET_POSNUM", {
        addChecksum: false,
        expectAck: true,
        timeout: MEASUREMENT_CONFIG.timeouts.command,
    });
}
async function startChannelMeasurement(socket, channelId) {
    console.log(` -> Sending START_CHNL for ${channelId}...`);
    const payload = { Channel: channelId };
    const jsonString = JSON.stringify(payload);
    const packet = buildAvrPacket("START_CHNL", jsonString);
    const timeout = MEASUREMENT_CONFIG.timeouts.startChannel;
    return new Promise((resolve, reject) => {
        let responseBuffer = Buffer.alloc(0);
        let timer = null;
        let cleanedUp = false;
        const cleanup = (error = null, result = null) => {
            if (cleanedUp) return;
            cleanedUp = true;
            clearTimeout(timer);
            socket.off("data", dataHandler);
            socket.off("error", errorHandler);
            socket.off("close", closeHandler);
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };
        const resetTimer = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                cleanup(
                    new Error(
                        `Measurement for ${channelId} timed out after ${
                            timeout / 1000
                        }s of inactivity.`
                    )
                );
            }, timeout);
        };
        const dataHandler = (data) => {
            responseBuffer = Buffer.concat([responseBuffer, data]);
            while (true) {
                const jsonStart = responseBuffer.indexOf("{");
                if (jsonStart === -1) break;
                let braceCount = 0;
                let jsonEnd = -1;
                for (let i = jsonStart; i < responseBuffer.length; i++) {
                    if (responseBuffer[i] === 0x7b) {
                        braceCount++;
                    } else if (responseBuffer[i] === 0x7d) {
                        braceCount--;
                    }
                    if (braceCount === 0) {
                        jsonEnd = i;
                        break;
                    }
                }
                if (jsonEnd === -1) break;
                const jsonSlice = responseBuffer.slice(jsonStart, jsonEnd + 1);
                let parsedReport;

                try {
                    parsedReport = JSON.parse(jsonSlice.toString("utf8"));
                } catch (e) {
                    console.warn(
                        `Warning: Could not parse a complete JSON object for ${channelId}. This can happen and is often recovered on the next data packet.`
                    );
                    break;
                }
                resetTimer();
                if (parsedReport.SpConnect || parsedReport.ChReport) {
                    if (parsedReport.Polarity === "R") {
                        const isSubwoofer = channelId.startsWith("SW");
                        const advice = isSubwoofer
                            ? "Check the Phase/Polarity switch on the back of the sub (should be 0° or Normal)."
                            : "Check the speaker wiring (+ to + and - to -).";

                        console.warn(
                            `WARNING: AVR reports INVERTED POLARITY for channel ${channelId}! ${advice} You can still complete the measurement process if you need to as Acoustica can fix this.`
                        );
                    }
                    cleanup(null, parsedReport);
                    return;
                }
                responseBuffer = responseBuffer.slice(jsonEnd + 1);
            }
        };
        const errorHandler = (err) =>
            cleanup(new Error(`Socket error during measurement: ${err.message}`));
        const closeHandler = () =>
            cleanup(new Error("Connection closed unexpectedly during measurement."));
        socket.on("data", dataHandler);
        socket.on("error", errorHandler);
        socket.once("close", closeHandler);
        resetTimer();
        socket.write(packet, (err) => {
            if (err) {
                cleanup(new Error(`Socket write failed for START_CHNL: ${err.message}`));
            }
        });
    });
}
async function getChannelImpulseResponse(socket, channelId) {
    const COMMAND_NAME = "GET_RESPON";
    //console.log(` -> Sending ${COMMAND_NAME} for ${channelId} to fetch impulse data...`);
    const payload = { ChData: channelId };
    const jsonString = JSON.stringify(payload);
    const packet = buildAvrPacket(COMMAND_NAME, jsonString);
    const timeout = MEASUREMENT_CONFIG.timeouts.getResponse;
    return new Promise((resolve, reject) => {
        let responseBuffer = Buffer.alloc(0);
        const receivedPackets = new Map();
        let lastSeqNum = -1;
        let timer = null;
        let cleanedUp = false;
        const cleanup = (error = null, result = null) => {
            if (cleanedUp) return;
            cleanedUp = true;
            clearTimeout(timer);
            socket.off("data", dataHandler);
            socket.off("error", errorHandler);
            socket.off("close", closeHandler);
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        };
        const resetTimer = () => {
            clearTimeout(timer);
            timer = setTimeout(
                () =>
                    cleanup(
                        new Error(`Timeout waiting for impulse data packets for ${channelId}.`)
                    ),
                timeout
            );
        };
        const processDataBuffer = () => {
            while (responseBuffer.length > 5) {
                const parsedPacket = parseIncomingPacket(responseBuffer);
                if (parsedPacket) {
                    if (parsedPacket.payload) {
                        if (lastSeqNum === -1) {
                            lastSeqNum = parsedPacket.lastSeq;
                        }
                        if (!receivedPackets.has(parsedPacket.currentSeq)) {
                            receivedPackets.set(parsedPacket.currentSeq, parsedPacket.payload);
                        }
                    }
                    responseBuffer = responseBuffer.slice(parsedPacket.totalLength);
                    if (lastSeqNum !== -1 && receivedPackets.size === lastSeqNum + 1) {
                        const allPayloads = [];
                        for (let i = 0; i <= lastSeqNum; i++) {
                            if (!receivedPackets.has(i)) {
                                cleanup(
                                    new Error(
                                        `Missing impulse response packet ${i} for ${channelId}.`
                                    )
                                );
                                return;
                            }
                            allPayloads.push(receivedPackets.get(i));
                        }
                        cleanup(null, Buffer.concat(allPayloads));
                        return;
                    }
                } else {
                    break;
                }
            }
        };
        const dataHandler = (data) => {
            resetTimer();
            responseBuffer = Buffer.concat([responseBuffer, data]);
            processDataBuffer();
        };
        const errorHandler = (err) =>
            cleanup(new Error(`Socket error getting impulse response: ${err.message}`));
        const closeHandler = () =>
            cleanup(new Error("Connection closed getting impulse response."));
        socket.on("data", dataHandler);
        socket.on("error", errorHandler);
        socket.once("close", closeHandler);
        resetTimer();
        socket.write(packet, (err) => {
            if (err) {
                cleanup(new Error(`Socket write failed for ${COMMAND_NAME}: ${err.message}`));
            }
        });
    });
}
initializeApp();
