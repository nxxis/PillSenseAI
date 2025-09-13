<<<<<<< Updated upstream
// apps/api/src/routes/reminders.js
import { Router } from 'express';
import Joi from 'joi';
import schedule from 'node-schedule';
import { broadcastReminder } from '../ws-server.js';
import { Reminder } from '../models/Reminder.js';

const router = Router();

const schema = Joi.object({
  drug: Joi.string().required(),
  doseMg: Joi.number().min(0).required(),
  frequencyPerDay: Joi.number().min(1).max(24).required(),
  nextAtISO: Joi.string().isoDate().required(),
  contact: Joi.object({
    email: Joi.string().email().optional(),
  }).optional(),
});

function nowISO() {
  return new Date().toISOString();
}
function addMinutesISO(baseISO, minutes) {
  const t = baseISO ? new Date(baseISO) : new Date();
  const next = new Date(t.getTime() + minutes * 60 * 1000);
  return next.toISOString();
}

/**
 * POST /api/reminders
 * Body: { drug, doseMg, frequencyPerDay, nextAtISO, contact? }
 * Behavior:
 *  - NO BUFFER: store exactly the time set.
 *  - If the chosen time is already in the past today, roll it to the **same time tomorrow**.
 *  - UPSERT: only one reminder per (drug, doseMg, frequencyPerDay).
 *  - After upsert, delete any duplicates for that key.
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const filter = {
      drug: value.drug,
      doseMg: value.doseMg,
      frequencyPerDay: value.frequencyPerDay,
    };

    // Log received time and server time
    console.log(
      '[Reminder POST] Received nextAtISO:',
      value.nextAtISO,
      'Server time:',
      new Date().toISOString()
    );
    // exact time as set (no buffer)
    let nextAt = new Date(value.nextAtISO);
    if (isNaN(nextAt.getTime())) {
      return res.status(400).json({ ok: false, error: 'invalid_nextAtISO' });
    }

    // Always schedule for the exact selected time, even if in the past or very soon
    // Log final scheduled time
    console.log(
      '[Reminder POST] Final scheduled nextAtISO:',
      nextAt.toISOString()
    );

    const update = {
      nextAtISO: nextAt.toISOString(),
      ...(value.contact ? { contact: value.contact } : {}),
    };

    // Upsert by (drug, doseMg, frequencyPerDay)
    const doc = await Reminder.findOneAndUpdate(
      filter,
      { $set: update },
      { new: true }
    );
    let finalDoc = doc;

    if (!doc) {
      finalDoc = await Reminder.create({
        ...value,
        nextAtISO: update.nextAtISO,
      });
    } else if (
      value.contact &&
      (!doc.contact || doc.contact.email !== value.contact.email)
    ) {
      doc.contact = value.contact;
      await doc.save();
      finalDoc = doc;
    }

    // Dedupe any leftovers for same key
    await Reminder.deleteMany({
      _id: { $ne: finalDoc._id },
      drug: filter.drug,
      doseMg: filter.doseMg,
      frequencyPerDay: filter.frequencyPerDay,
    });

    // Schedule the reminder job immediately after upsert
    await scheduleReminderJob(finalDoc);
    res.json({ ok: true, data: finalDoc });
  } catch (e) {
    console.error('[Reminders] create/upsert error:', e);
    res.status(500).json({ ok: false, error: 'create_failed' });
  }
});

/**
 * GET /api/reminders
 */
router.get('/', async (_req, res) => {
  try {
    const docs = await Reminder.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ ok: true, data: docs });
  } catch (e) {
    console.error('[Reminders] list error:', e);
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

/**
 * GET /api/reminders/due?window=MIN
 * Returns reminders with nextAtISO <= now + window minutes (default 1).
 */
router.get('/due', async (req, res) => {
  try {
    const windowMin = Math.max(
      1,
      Math.min(30, parseInt(req.query.window || '1', 10) || 1)
    );
    const horizon = addMinutesISO(nowISO(), windowMin);
    const due = await Reminder.find({ nextAtISO: { $lte: horizon } })
      .sort({ nextAtISO: 1 })
      .limit(100)
      .lean();
    res.json({ ok: true, data: due });
  } catch (e) {
    console.error('[Reminders] due error:', e);
    res.status(500).json({ ok: false, error: 'due_failed' });
  }
});

/**
 * DELETE /api/reminders/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Reminder.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Reminders] delete error:', e);
    res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});

/**
 * Demo scheduler: fires every minute.
 * - Logs reminders that are due (<= now)
 * - Advances nextAtISO:
 *     - freq=1: same time next day
 *     - freq>1: + (24h / freq) minutes — preserves time-of-day pattern
 */
// In-memory job map
const reminderJobs = new Map();

async function scheduleReminderJob(reminder) {
  const reminderId = reminder._id.toString();
  // Cancel any existing job for this reminder
  if (reminderJobs.has(reminderId)) {
    const oldJob = reminderJobs.get(reminderId);
    oldJob.cancel();
  }
  const nextAt = new Date(reminder.nextAtISO);
  if (nextAt > new Date()) {
    const job = schedule.scheduleJob(nextAt, async function () {
      const firedAt = new Date().toISOString();
      console.log(
        `[REMINDER FIRED] ${reminder.drug} ${reminder.doseMg} mg — notify ${
          reminder.contact?.email || 'user'
        } (scheduled for ${reminder.nextAtISO}, fired at ${firedAt})`
      );
      // Broadcast to all connected WebSocket clients
      broadcastReminder(reminder);
      // Reschedule next occurrence
      const freq = Math.max(
        1,
        Math.min(24, Number(reminder.frequencyPerDay) || 1)
      );
      const current = new Date(reminder.nextAtISO);
      let next;
      if (freq === 1) {
        next = new Date(current);
        next.setDate(next.getDate() + 1);
      } else {
        const intervalMin = Math.round((24 * 60) / freq);
        next = new Date(current.getTime() + intervalMin * 60 * 1000);
      }
      reminder.nextAtISO = next.toISOString();
      await reminder.save();
      // Schedule next job
      scheduleReminderJob(reminder);
    });
    reminderJobs.set(reminderId, job);
  }
}

export async function startReminderScheduler() {
  // On startup, schedule jobs for all reminders
  const reminders = await Reminder.find();
  for (const r of reminders) {
    scheduleReminderJob(r);
  }
  // Watch for new/updated reminders
  // You may want to hook this into your create/update/delete logic for real-time scheduling
  // ...existing code...
}

export default router;
=======
// apps/api/src/routes/reminders.js
import { Router } from 'express';
import Joi from 'joi';
import cron from 'node-cron';
import { Reminder } from '../models/Reminder.js';

const router = Router();

const schema = Joi.object({
  drug: Joi.string().required(),
  doseMg: Joi.number().min(0).required(),
  frequencyPerDay: Joi.number().min(1).max(24).required(),
  nextAtISO: Joi.string().isoDate().required(),
  contact: Joi.object({
    email: Joi.string().email().optional(),
  }).optional(),
});

function nowISO() {
  return new Date().toISOString();
}
function addMinutesISO(baseISO, minutes) {
  const t = baseISO ? new Date(baseISO) : new Date();
  const next = new Date(t.getTime() + minutes * 60 * 1000);
  return next.toISOString();
}

/**
 * POST /api/reminders
 * Body: { drug, doseMg, frequencyPerDay, nextAtISO, contact? }
 * Behavior:
 *  - NO BUFFER: store exactly the time set.
 *  - If the chosen time is already in the past today, roll it to the **same time tomorrow**.
 *  - UPSERT: only one reminder per (drug, doseMg, frequencyPerDay).
 *  - After upsert, delete any duplicates for that key.
 */
router.post('/', async (req, res) => {
  try {
    const { error, value } = schema.validate(req.body || {});
    if (error) return res.status(400).json({ ok: false, error: error.message });

    const filter = {
      drug: value.drug,
      doseMg: value.doseMg,
      frequencyPerDay: value.frequencyPerDay,
    };

    // exact time as set (no buffer)
    let nextAt = new Date(value.nextAtISO);
    if (isNaN(nextAt.getTime())) {
      return res.status(400).json({ ok: false, error: 'invalid_nextAtISO' });
    }

    // If it's already in the past today, schedule for same clock time tomorrow
    const now = new Date();
    if (nextAt <= now) {
      const roll = new Date(nextAt);
      roll.setDate(roll.getDate() + 1);
      nextAt = roll;
    }

    const update = {
      nextAtISO: nextAt.toISOString(),
      ...(value.contact ? { contact: value.contact } : {}),
    };

    // Upsert by (drug, doseMg, frequencyPerDay)
    const doc = await Reminder.findOneAndUpdate(
      filter,
      { $set: update },
      { new: true }
    );
    let finalDoc = doc;

    if (!doc) {
      finalDoc = await Reminder.create({
        ...value,
        nextAtISO: update.nextAtISO,
      });
    } else if (
      value.contact &&
      (!doc.contact || doc.contact.email !== value.contact.email)
    ) {
      doc.contact = value.contact;
      await doc.save();
      finalDoc = doc;
    }

    // Dedupe any leftovers for same key
    await Reminder.deleteMany({
      _id: { $ne: finalDoc._id },
      drug: filter.drug,
      doseMg: filter.doseMg,
      frequencyPerDay: filter.frequencyPerDay,
    });

    res.json({ ok: true, data: finalDoc });
  } catch (e) {
    console.error('[Reminders] create/upsert error:', e);
    res.status(500).json({ ok: false, error: 'create_failed' });
  }
});

/**
 * GET /api/reminders
 */
router.get('/', async (_req, res) => {
  try {
    const docs = await Reminder.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ ok: true, data: docs });
  } catch (e) {
    console.error('[Reminders] list error:', e);
    res.status(500).json({ ok: false, error: 'list_failed' });
  }
});

/**
 * GET /api/reminders/due?window=MIN
 * Returns reminders with nextAtISO <= now + window minutes (default 1).
 */
router.get('/due', async (req, res) => {
  try {
    const windowMin = Math.max(
      1,
      Math.min(30, parseInt(req.query.window || '1', 10) || 1)
    );
    const horizon = addMinutesISO(nowISO(), windowMin);
    const due = await Reminder.find({ nextAtISO: { $lte: horizon } })
      .sort({ nextAtISO: 1 })
      .limit(100)
      .lean();
    res.json({ ok: true, data: due });
  } catch (e) {
    console.error('[Reminders] due error:', e);
    res.status(500).json({ ok: false, error: 'due_failed' });
  }
});

/**
 * DELETE /api/reminders/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const doc = await Reminder.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[Reminders] delete error:', e);
    res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});

/**
 * Demo scheduler: fires every minute.
 * - Logs reminders that are due (<= now)
 * - Advances nextAtISO:
 *     - freq=1: same time next day
 *     - freq>1: + (24h / freq) minutes — preserves time-of-day pattern
 */
export function startReminderScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const due = await Reminder.find({
        nextAtISO: { $lte: now.toISOString() },
      }).limit(50);

      for (const r of due) {
        console.log(
          `[REMINDER] ${r.drug} ${r.doseMg} mg — notify ${
            r.contact?.email || 'user'
          } (due at ${r.nextAtISO})`
        );

        const freq = Math.max(1, Math.min(24, Number(r.frequencyPerDay) || 1));
        const current = new Date(r.nextAtISO);

        if (freq === 1) {
          // same clock time, next day
          const next = new Date(current);
          next.setDate(next.getDate() + 1);
          r.nextAtISO = next.toISOString();
        } else {
          // keep interval consistent across the day
          const intervalMin = Math.round((24 * 60) / freq);
          const next = new Date(current.getTime() + intervalMin * 60 * 1000);
          r.nextAtISO = next.toISOString();
        }

        await r.save();
      }
    } catch (e) {
      console.error('[Scheduler] error:', e.message);
    }
  });
}

export default router;
>>>>>>> Stashed changes
