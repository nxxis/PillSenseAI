import mongoose from 'mongoose';

const PrescriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    drug: { type: String, required: true },
    drugKey: { type: String, required: true, index: true },
    doseMg: { type: Number, required: true, min: 0 },
    frequencyPerDay: { type: Number, required: true, min: 1, max: 24 },
    timing: { type: String, default: null }, // before meals, after meals, etc.

    startedAt: { type: Date, default: () => new Date() },
    endsAt: { type: Date, default: null },

    // flags
    source: { type: String, default: 'ocr' }, // ocr | manual
    flags: { type: Object, default: {} },

    // audit
    rawOcr: {
      text: { type: String, default: '' },
      confidence: { type: Number, default: 0 },
      wordsCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true, versionKey: false }
);

export const Prescription =
  mongoose.models.Prescription ||
  mongoose.model('Prescription', PrescriptionSchema);
