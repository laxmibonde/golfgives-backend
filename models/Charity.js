const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  location: String,
  description: String,
  registrationUrl: String,
}, { _id: true });

const charitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Charity name is required'],
    trim: true,
    unique: true,
  },
  slug: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
  },
  description: {
    type: String,
    required: true,
  },
  shortDescription: {
    type: String,
    maxlength: 160,
  },
  logo: String,
  coverImage: String,
  images: [String],
  website: String,
  category: {
    type: String,
    enum: ['health', 'environment', 'education', 'sport', 'community', 'other'],
    default: 'other',
  },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  upcomingEvents: [eventSchema],
  // ── Financials ─────────────────────────────────────────────────────────────
  totalContributions: { type: Number, default: 0 },
  subscriberCount: { type: Number, default: 0 },
}, { timestamps: true });

// Auto-generate slug from name
charitySchema.pre('save', function (next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Charity', charitySchema);
