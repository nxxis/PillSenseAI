import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },

    // NEW
    dobISO: { type: String, default: null }, // e.g., 1995-06-15
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'unspecified', null],
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

// Ensure email is always stored lowercase
UserSchema.pre('save', function (next) {
  if (this.email) this.email = String(this.email).toLowerCase().trim();
  next();
});

// Virtual age (years)
UserSchema.virtual('ageYears').get(function () {
  if (!this.dobISO) return null;
  const dob = new Date(this.dobISO);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age >= 0 ? age : null;
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
