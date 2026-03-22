/**
 * Seed script — creates admin user + sample charities
 * Run: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User    = require('./models/User');
const Charity = require('./models/Charity');
const Score   = require('./models/Score');

const CHARITIES = [
  {
    name: 'Golf Foundation',
    shortDescription: 'Making golf accessible for young people across the UK.',
    description: 'The Golf Foundation exists to inspire young people through golf. We deliver programmes in schools and communities, helping children and teenagers discover the game.',
    category: 'sport',
    isFeatured: true,
    website: 'https://golf-foundation.org.uk',
  },
  {
    name: 'Macmillan Cancer Support',
    shortDescription: 'Life-changing support for people living with cancer.',
    description: 'Macmillan provides medical, emotional, practical and financial support to people living with cancer, and campaigns for better cancer care.',
    category: 'health',
    isFeatured: true,
  },
  {
    name: 'Mind Mental Health',
    shortDescription: 'Better mental health support for everyone.',
    description: 'Mind provides advice and support to empower anyone experiencing a mental health problem. We campaign to improve services, raise awareness and promote understanding.',
    category: 'health',
  },
  {
    name: 'Trees for Cities',
    shortDescription: 'Planting trees and creating greener communities.',
    description: 'Trees for Cities is the only UK charity working at a national and international scale to improve lives by planting trees in cities.',
    category: 'environment',
  },
  {
    name: 'Street League',
    shortDescription: 'Using sport to help young people into employment.',
    description: 'Street League uses the power of sport to break the cycle of youth unemployment, running intensive programmes that build confidence, skills and connections.',
    category: 'community',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  console.log('✅ Connected to MongoDB');

  // Clear ALL existing data
  await Promise.all([
    User.deleteMany({}),
    Score.deleteMany({}),
    Charity.deleteMany({}),
  ]);

  // Create admin
  const admin = await User.create({
    name: 'Platform Admin',
    email: 'admin@golfgives.com',
    password: 'Admin1234!',
    role: 'admin',
    subscription: { status: 'active', plan: 'yearly' },
  });
  await Score.create({ user: admin._id, scores: [] });
  console.log('✅ Admin created — admin@golfgives.com / Admin1234!');

  // Create test subscriber
  const subscriber = await User.create({
    name: 'Test Golfer',
    email: 'golfer@test.com',
    password: 'Golfer123!',
    role: 'subscriber',
    subscription: { status: 'active', plan: 'monthly' },
  });
  await Score.create({
    user: subscriber._id,
    scores: [
      { value: 32, date: new Date('2026-03-15') },
      { value: 28, date: new Date('2026-03-08') },
      { value: 35, date: new Date('2026-03-01') },
    ],
  });
  console.log('✅ Test subscriber created — golfer@test.com / Golfer123!');

  // Create charities
  await Charity.insertMany(CHARITIES);
  console.log(`✅ ${CHARITIES.length} charities created`);

  mongoose.disconnect();
  console.log('🏁 Seed complete');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
