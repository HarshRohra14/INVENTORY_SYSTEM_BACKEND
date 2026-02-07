// src/lib/prisma.js
const { PrismaClient } = require('@prisma/client');

// This creates ONE global instance of Prisma Client
const prisma = new PrismaClient();

module.exports = prisma;