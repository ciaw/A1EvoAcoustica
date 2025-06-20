const MIN_DB_LEVEL = -200; // Minimum decibel level to prevent log(0) errors.
const MIN_MAGNITUDE_THRESHOLD = 1e-10; // Magnitudes below this are treated as silence.
const FILTER_TYPE = {
  LINKWITZ_RILEY: 'L-R',
  BUTTERWORTH: 'BU',
  LOW_PASS: 'LP',
  HIGH_PASS: 'HP',};
const MESSAGE_TYPE = {
  INIT: 'init',
  TASK_BATCH: 'taskBatch',
  BATCH_RESULT: 'batchResult',};
let state = {
  analysisFrequencies: null,
  subMagnitude: null,
  targetMagnitude: null,
  pointsPerOctave: 0,
  analysisStartFreq: 0,
  lowPassCutoffCandidates: [],
  highPassCutoffCandidates: [], // Will be populated in handleInit
  // Pre-defined filter configurations to test.
  highPassFilterConfigs: [
    { type: FILTER_TYPE.LINKWITZ_RILEY, slope: 24 },
    { type: FILTER_TYPE.LINKWITZ_RILEY, slope: 36 },
    { type: FILTER_TYPE.LINKWITZ_RILEY, slope: 48 },
    { type: FILTER_TYPE.BUTTERWORTH, slope: 12 },
    { type: FILTER_TYPE.BUTTERWORTH, slope: 18 },
    { type: FILTER_TYPE.BUTTERWORTH, slope: 24 },
    { type: FILTER_TYPE.BUTTERWORTH, slope: 36 },
    { type: FILTER_TYPE.BUTTERWORTH, slope: 48 },
  ],
  lowPassFilterConfig: { type: FILTER_TYPE.LINKWITZ_RILEY, slope: 24 },
  filterMagnitudeCache: new Map(),};
function freqToIndex(freq, startFreq, pointsPerOctave, totalPoints) {
  if (freq < startFreq) return 0;
  const index = pointsPerOctave * Math.log2(freq / startFreq);
  return Math.min(Math.round(index), totalPoints - 1);}
function getLRFilterGain(freq, cutoff, linkwitzRileyOrder, type) {
  if (freq <= 0 || cutoff <= 0 || linkwitzRileyOrder <= 0) return MIN_DB_LEVEL;
  const ratio = freq / cutoff;
  const ratioPow = Math.pow(ratio, linkwitzRileyOrder);
  let magnitude;
  if (type === FILTER_TYPE.LOW_PASS) {
    magnitude = 1 / (1 + ratioPow);
  } else if (type === FILTER_TYPE.HIGH_PASS) {
    magnitude = ratioPow / (1 + ratioPow);
  } else {
    return MIN_DB_LEVEL; // Should not happen with validated input
  }
  if (magnitude <= MIN_MAGNITUDE_THRESHOLD) return MIN_DB_LEVEL;
  return 20 * Math.log10(magnitude);}
function getButterworthFilterGain(freq, cutoff, order, type) {
  if (freq <= 0 || cutoff <= 0 || order <= 0) return MIN_DB_LEVEL;
  const ratio = freq / cutoff;
  let magnitude;
  if (type === FILTER_TYPE.LOW_PASS) {
    magnitude = 1 / Math.sqrt(1 + Math.pow(ratio, 2 * order));
  } else if (type === FILTER_TYPE.HIGH_PASS) {
    magnitude = Math.pow(ratio, order) / Math.sqrt(1 + Math.pow(ratio, 2 * order));
  } else {
    return MIN_DB_LEVEL; // Should not happen with validated input
  }
  if (magnitude <= MIN_MAGNITUDE_THRESHOLD) return MIN_DB_LEVEL;
  return 20 * Math.log10(magnitude);}
function applyFilters(dataMagnitude, frequencies, highPassFreq, highPassConfig, lowPassFreq, lowPassConfig) {
  const filteredMagnitude = new Float32Array(dataMagnitude.length);
  for (let i = 0; i < dataMagnitude.length; i++) {
    const freq = frequencies[i];
    const originalMag = dataMagnitude[i];
    if (isNaN(originalMag)) {
      filteredMagnitude[i] = NaN;
      continue;
    }
    let highPassGain = MIN_DB_LEVEL;
    // The order of an audio filter is its slope in dB/octave divided by 6.
    if (highPassConfig.type === FILTER_TYPE.LINKWITZ_RILEY) {
      const highPassEffectiveOrder = highPassConfig.slope / 6;
      highPassGain = getLRFilterGain(freq, highPassFreq, highPassEffectiveOrder, FILTER_TYPE.HIGH_PASS);
    } else if (highPassConfig.type === FILTER_TYPE.BUTTERWORTH) {
      const highPassOrder = highPassConfig.slope / 6;
      highPassGain = getButterworthFilterGain(freq, highPassFreq, highPassOrder, FILTER_TYPE.HIGH_PASS);
    }
    let lowPassGain = MIN_DB_LEVEL;
    if (lowPassConfig.type === FILTER_TYPE.LINKWITZ_RILEY) {
      const lowPassEffectiveOrder = lowPassConfig.slope / 6;
      lowPassGain = getLRFilterGain(freq, lowPassFreq, lowPassEffectiveOrder, FILTER_TYPE.LOW_PASS);
    } else if (lowPassConfig.type === FILTER_TYPE.BUTTERWORTH) {
      const lowPassOrder = lowPassConfig.slope / 6;
      lowPassGain = getButterworthFilterGain(freq, lowPassFreq, lowPassOrder, FILTER_TYPE.LOW_PASS);
    }
    // Add gains in dB, which is equivalent to multiplying magnitudes.
    filteredMagnitude[i] = originalMag + highPassGain + lowPassGain;
  }
  return filteredMagnitude;}
function calculateVolumeAdjustmentAndError(responseToAdjust, targetMagnitude, frequencies, errorRangeStartFreq, errorRangeEndFreq, pointsPerOctave, analysisStartFreq) {
  let sumDiff = 0;
  let count = 0;
  let sumAbsoluteDiff = 0;
  const totalPoints = frequencies.length;
  const startIndex = freqToIndex(errorRangeStartFreq, analysisStartFreq, pointsPerOctave, totalPoints);
  const endIndex = freqToIndex(errorRangeEndFreq, analysisStartFreq, pointsPerOctave, totalPoints);
  // Validate indices before proceeding.
  if (startIndex >= totalPoints || endIndex < 0 || startIndex > endIndex) {
    return { volumeAdjustment: 0, meanAbsoluteError: Infinity };
  }
  // First pass: find the average difference to determine the volume adjustment.
  for (let i = startIndex; i <= endIndex; i++) {
    if (isFinite(responseToAdjust[i]) && isFinite(targetMagnitude[i])) {
      sumDiff += (targetMagnitude[i] - responseToAdjust[i]);
      count++;
    }
  }
  if (count === 0) {
    return { volumeAdjustment: 0, meanAbsoluteError: Infinity };
  }
  const volumeAdjustment = sumDiff / count;
  // Second pass: calculate Mean Absolute Error (MAE) after applying the volume adjustment.
  for (let i = startIndex; i <= endIndex; i++) {
    if (isFinite(responseToAdjust[i]) && isFinite(targetMagnitude[i])) {
      const alignedResponse = responseToAdjust[i] + volumeAdjustment;
      const diff = alignedResponse - targetMagnitude[i];
      sumAbsoluteDiff += Math.abs(diff);
    }
  }
  const meanAbsoluteError = sumAbsoluteDiff / count;
  return { volumeAdjustment, meanAbsoluteError };}
function evaluateConfiguration(hpFreq, hpConfig, lpFreq, lpConfig, errorEvalStartFreq, errorEvalEndFreq) {
  // Create a cache key from the unique parameters of the filter combination.
  const cacheKey = `${hpFreq}-${hpConfig.type}-${hpConfig.slope}-${lpFreq}-${lpConfig.type}-${lpConfig.slope}`;
  let filteredTarget;
  if (state.filterMagnitudeCache.has(cacheKey)) {
    filteredTarget = state.filterMagnitudeCache.get(cacheKey);
  } else {
    filteredTarget = applyFilters(
      state.targetMagnitude,
      state.analysisFrequencies,
      hpFreq,
      hpConfig,
      lpFreq,
      lpConfig
    );
    state.filterMagnitudeCache.set(cacheKey, filteredTarget);
  }
  return calculateVolumeAdjustmentAndError(
    state.subMagnitude,
    filteredTarget,
    state.analysisFrequencies,
    errorEvalStartFreq,
    errorEvalEndFreq,
    state.pointsPerOctave,
    state.analysisStartFreq
  );}
function handleInit(data) {
  // Validate input data to ensure robustness.
  // Note: For ArrayBuffers, check .byteLength instead of .length
  if (!data.fixedAnalysisFrequencies || data.fixedAnalysisFrequencies.byteLength === 0) {
    throw new Error('Invalid or missing frequency data for initialization.');
  }
  if (!data.fixedAnalysisSubMagnitude || data.fixedAnalysisSubMagnitude.byteLength === 0) {
    throw new Error('Invalid or missing subwoofer magnitude data for initialization.');
  }
  if (!data.fixedAnalysisTargetMagnitude || data.fixedAnalysisTargetMagnitude.byteLength === 0) {
    throw new Error('Invalid or missing target magnitude data for initialization.');
  }
  state.analysisFrequencies = new Float32Array(data.fixedAnalysisFrequencies);
  state.subMagnitude = new Float32Array(data.fixedAnalysisSubMagnitude);
  state.targetMagnitude = new Float32Array(data.fixedAnalysisTargetMagnitude);
  state.pointsPerOctave = data.commonPpo;
  state.analysisStartFreq = data.fixedOverallAnalysisStartFreq;
  // lpCutoffCandidates is passed as a regular array of numbers from the main thread.
  if (!data.lpCutoffCandidates || !Array.isArray(data.lpCutoffCandidates)) {
      throw new Error('Invalid or missing lpCutoffCandidates for initialization.');
  }
  state.lowPassCutoffCandidates = data.lpCutoffCandidates;
  const hpSearchStep = data.hpSearchStep;
  const hpFreqMin = data.hpCandidateMinFreq; // Use passed min
  let hpFreqMax = data.hpCandidateMaxFreq;   // Use passed (potentially dynamic) max
  // Robustness check: Ensure hpFreqMax is not less than hpFreqMin.
  // This should be guaranteed by main thread logic, but good for internal consistency.
  if (hpFreqMax < hpFreqMin) {
    console.warn(`Worker init: Received hpCandidateMaxFreq (${hpFreqMax.toFixed(2)}) is less than hpCandidateMinFreq (${hpFreqMin.toFixed(2)}). Adjusting hpFreqMax to hpFreqMin.`);
    hpFreqMax = hpFreqMin;
  }
  // Calculate the number of high-pass cutoff candidates.
  let numSteps;
  if (hpSearchStep <= 0) {
      console.warn(`Worker init: hpSearchStep (${hpSearchStep}) is not positive. Defaulting to a single HP candidate at hpFreqMin (${hpFreqMin.toFixed(2)}Hz).`);
      numSteps = 0; // This will result in one candidate: hpFreqMin
  } else {
      // Math.floor ensures we don't exceed hpFreqMax with the last step.
      numSteps = Math.floor((hpFreqMax - hpFreqMin) / hpSearchStep);
  }
  if (numSteps < 0) {
    // This case implies hpFreqMax < hpFreqMin, which should have been caught above,
    // or an issue with hpSearchStep that wasn't caught (e.g., NaN).
    // This is an unlikely scenario if previous checks are in place.
    console.error(`Worker init: Calculated numSteps (${numSteps}) is negative for HP candidates. This is unexpected. Defaulting to a single candidate: [${hpFreqMin.toFixed(2)}Hz].`);
    state.highPassCutoffCandidates = [hpFreqMin];
  } else {
    state.highPassCutoffCandidates = Array.from(
      { length: numSteps + 1 }, // If numSteps is 0 (e.g., hpFreqMax === hpFreqMin), length is 1.
      (_, i) => hpFreqMin + i * hpSearchStep
    );
  }
  state.filterMagnitudeCache.clear();
  const firstHpCandidateLog = state.highPassCutoffCandidates.length > 0 ? state.highPassCutoffCandidates[0].toFixed(2) : "N/A";
  const lastHpCandidateLog = state.highPassCutoffCandidates.length > 0 ? state.highPassCutoffCandidates[state.highPassCutoffCandidates.length - 1].toFixed(2) : "N/A";
  console.log(
    `Worker initialized. HP candidates (${state.highPassCutoffCandidates.length}): ` +
    `from ${firstHpCandidateLog}Hz to ${lastHpCandidateLog}Hz ` +
    `(target max ${hpFreqMax.toFixed(2)}Hz, min ${hpFreqMin.toFixed(2)}Hz, step ${hpSearchStep}Hz).`
  );}
function handleTaskBatch(data) {
  const { tasks, batchId } = data;
  let minErrorForBatch = Infinity;
  let bestResultForBatch = null;
  for (const task of tasks) {
    const { errorEvalStartFreq, errorEvalEndFreq } = task;
    let minErrorForCurrentTask = Infinity;
    let optimalParamsForCurrentTask = {};
    for (const hpFreq of state.highPassCutoffCandidates) {
      for (const lpFreq of state.lowPassCutoffCandidates) {
        if (lpFreq <= hpFreq) continue; // Crossover points must not overlap incorrectly.
        for (const hpConfig of state.highPassFilterConfigs) {
          const currentLpConfig = state.lowPassFilterConfig;
          const { volumeAdjustment, meanAbsoluteError } = evaluateConfiguration(
            hpFreq, hpConfig, lpFreq, currentLpConfig, errorEvalStartFreq, errorEvalEndFreq
          );
          if (meanAbsoluteError < minErrorForCurrentTask) {
            minErrorForCurrentTask = meanAbsoluteError;
            optimalParamsForCurrentTask = {
              highPassFreq: hpFreq,
              highPassConfig: hpConfig,
              lowPassFreq: lpFreq,
              lowPassConfig: currentLpConfig,
              volumeAdjustment: volumeAdjustment,
            };
          }
        }
      }
    }
    if (minErrorForCurrentTask < minErrorForBatch) {
      minErrorForBatch = minErrorForCurrentTask;
      const { highPassFreq, highPassConfig, lowPassFreq, lowPassConfig, volumeAdjustment } = optimalParamsForCurrentTask;
      bestResultForBatch = {
        highPassFreq: highPassFreq,
        highPassSlope: highPassConfig ? highPassConfig.slope : null,
        highPassType: highPassConfig ? highPassConfig.type : null,
        lowPassFreq: lowPassFreq,
        lowPassSlope: lowPassConfig ? lowPassConfig.slope : null,
        lowPassType: lowPassConfig ? lowPassConfig.type : null,
        volumeAdjustment: volumeAdjustment,
        minError: minErrorForCurrentTask,
        optimalErrorRangeStart: errorEvalStartFreq,
        optimalErrorRangeEnd: errorEvalEndFreq,
      };
    }
  }
  self.postMessage({
    type: MESSAGE_TYPE.BATCH_RESULT,
    batchId: batchId,
    result: bestResultForBatch,
  });}
self.onmessage = function(event) {
  const { type, ...data } = event.data;
  // Use a switch statement for clear and organized message routing.
  switch (type) {
    case MESSAGE_TYPE.INIT:
      handleInit(data);
      break;
    case MESSAGE_TYPE.TASK_BATCH:
      handleTaskBatch(event.data); // Pass the full event.data for simplicity
      break;
    default:
      console.error(`Unknown message type received: ${type}`);
      break;
  }};