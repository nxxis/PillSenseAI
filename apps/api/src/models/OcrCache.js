// apps/api/src/models/OcrCache.js
import mongoose from 'mongoose';

const OcrCacheSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    imageHash: { type: String, required: true }, // sha256 hex
    parsed: {
      drug: String,
      doseMg: Number,
      frequencyPerDay: Number,
    },
    savedPrescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
  },
  { timestamps: true }
);

// one cache entry per user per exact image
OcrCacheSchema.index({ userId: 1, imageHash: 1 }, { unique: true });

export const OcrCache = mongoose.model('OcrCache', OcrCacheSchema);
