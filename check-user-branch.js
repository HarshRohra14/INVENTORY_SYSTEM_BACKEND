const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserBranch() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: 'cml0x3v900ge8kqv9j2ykewys' },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (user) {
      console.log('User found:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Branch ID: ${user.branchId}`);
      console.log(`  Branch Name: ${user.branch?.name || 'No branch assigned'}`);
    } else {
      console.log('User not found');
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

checkUserBranch();
