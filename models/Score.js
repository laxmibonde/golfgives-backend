const mongoose = require('mongoose');

const scoreEntrySchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true,
    min: [1, 'Score must be at least 1'],
    max: [45, 'Score cannot exceed 45 (Stableford max)'],
  },
  date: {
    type: Date,
    required: true,
  },
}, { _id: false });

const scoreSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // One score document per user
  },
  scores: {
    type: [scoreEntrySchema],
    validate: {
      validator: (arr) => arr.length <= 5,
      message: 'A user can only hold 5 scores at a time',
    },
    default: [],
  },
}, { timestamps: true });

// Add a new score — rolling window of 5
scoreSchema.methods.addScore = function (value, date) {
  const entry = { value, date: date || new Date() };

  if (this.scores.length >= 5) {
    // Sort ascending by date and remove oldest
    this.scores.sort((a, b) => new Date(a.date) - new Date(b.date));
    this.scores.shift();
  }

  this.scores.push(entry);

  // Sort descending (most recent first) for display
  this.scores.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Get scores sorted newest-first (for display)
scoreSchema.virtual('sortedScores').get(function () {
  return [...this.scores].sort((a, b) => new Date(b.date) - new Date(a.date));
});

module.exports = mongoose.model('Score', scoreSchema);
