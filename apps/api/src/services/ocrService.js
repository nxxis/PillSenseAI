import Tesseract from 'tesseract.js';
import sharp from 'sharp';

/**
 * Run OCR with real progress reporting.
 * onProgress(percent, meta) is called with 0..100 (int).
 */
export async function ocrImageBufferWithProgress(buffer, onProgress) {
  const variants = await safeMakeVariants(buffer);
  const configs = tessConfigs();

  const totalTasks = variants.length * configs.length;
  let currentTask = 0;
  let best = { text: '', confidence: 0, wordsCount: 0, tag: 'none' };

  for (const v of variants) {
    for (const cfg of configs) {
      // Per-task progress listener from Tesseract (0..1)
      const out = await tesseractOnce(v.buffer, cfg, (p) => {
        // overall = (completed tasks + p) / total * 100
        const overall = Math.min(
          100,
          Math.round(((currentTask + p) / totalTasks) * 100)
        );
        onProgress?.(overall, { stage: `${v.tag}|${cfg.tag}` });
      });

      // update best
      if (
        out.confidence > best.confidence ||
        (out.confidence === best.confidence && out.wordsCount > best.wordsCount)
      ) {
        best = { ...out, tag: `${v.tag}|${cfg.tag}` };
      }

      currentTask += 1;
      onProgress?.(
        Math.min(100, Math.round((currentTask / totalTasks) * 100)),
        {
          stage: `${v.tag}|${cfg.tag}`,
        }
      );
    }
  }

  return {
    text: best.text,
    confidence: best.confidence,
    wordsCount: best.wordsCount,
  };
}

function tessConfigs() {
  // OEM: 1 = LSTM; 3 = Default (legacy+LSTM)
  // PSM: 6 = block of text; 7 = single line; 11 = sparse text
  return [
    { tag: 'oem1_psm6', oem: 1, psm: 6 },
    { tag: 'oem1_psm7', oem: 1, psm: 7 },
    { tag: 'oem1_psm11', oem: 1, psm: 11 },
    { tag: 'oem3_psm6', oem: 3, psm: 6 },
  ];
}

async function tesseractOnce(buf, cfg, onProgress) {
  const { data } = await Tesseract.recognize(buf, 'eng', {
    preserve_interword_spaces: '1',
    oem: cfg.oem,
    psm: cfg.psm,
    logger: (m) => {
      // m = { status, progress } where progress is 0..1
      if (typeof m?.progress === 'number') onProgress?.(m.progress);
    },
  });
  const text = data?.text || '';
  const confidence = data?.confidence ?? 0;
  const wordsCount = Array.isArray(data?.words) ? data.words.length : 0;
  return { text, confidence, wordsCount };
}

async function safeMakeVariants(buffer) {
  try {
    const img = sharp(buffer).rotate();

    const gray = await img.clone().grayscale().normalize().toBuffer();
    const hiContrast = await img
      .clone()
      .grayscale()
      .linear(1.2, -10)
      .normalize()
      .toBuffer();
    const bin = await img.clone().grayscale().threshold(140).toBuffer();
    const denoise = await img
      .clone()
      .grayscale()
      .median(1)
      .normalize()
      .toBuffer();

    return [
      { tag: 'raw', buffer },
      { tag: 'gray', buffer: gray },
      { tag: 'hi_contrast', buffer: hiContrast },
      { tag: 'binary', buffer: bin },
      { tag: 'denoise', buffer: denoise },
    ];
  } catch (e) {
    console.warn(
      '[OCR] sharp preprocessing failed, fallback to raw:',
      e.message
    );
    return [{ tag: 'raw_only', buffer }];
  }
}
