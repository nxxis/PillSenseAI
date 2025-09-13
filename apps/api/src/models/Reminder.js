import mongoose from 'mongoose';

const ReminderSchema = new mongoose.Schema(
  {
    drug: { type: String, required: true },
    doseMg: { type: Number, required: true, min: 0 },
    frequencyPerDay: { type: Number, required: true, min: 1, max: 24 },
    nextAtISO: { type: String, required: true }, // ISO date string of the next dose time
    contact: {
      email: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const Reminder =
  mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema);
