import { PrismaClient } from '@prisma/client';
import { hashPassword } from './utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Check if already seeded — if so, ensure all demo users exist (add any missing ones)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@aba-demo.com' },
  });
  if (existingAdmin) {
    console.log('✅ Database already seeded — checking for missing demo users...');
    
    // Ensure parent user exists (added Aug 14)
    const existingParent = await prisma.user.findUnique({
      where: { email: 'parent@aba-demo.com' },
    });
    if (!existingParent) {
      // Find the center from the admin
      const centerId = existingAdmin.centerId;
      const parentHash = await hashPassword('parent123');
      const parent = await prisma.user.create({
        data: {
          centerId,
          role: 'PARENT',
          name: 'Sarah Demo',
          email: 'parent@aba-demo.com',
          passwordHash: parentHash,
        },
      });
      console.log(`✅ Created missing parent: ${parent.email} / password: parent123`);
      
      // Link to first student in the center if available
      const firstStudent = await prisma.student.findFirst({ where: { centerId } });
      if (firstStudent && !firstStudent.parentId) {
        await prisma.student.update({
          where: { id: firstStudent.id },
          data: { parentId: parent.id },
        });
        console.log(`✅ Linked parent ${parent.name} to student ${firstStudent.name}`);
      }
    } else {
      console.log('✅ Parent user already exists.');
    }
    
    return;
  }

  // Create demo center
  const center = await prisma.center.create({
    data: {
      name: 'ABA Demo Center',
    },
  });

  // Create subscription linked to center
  await prisma.subscription.create({
    data: {
      centerId: center.id,
      plan: 'PRO',
      status: 'ACTIVE',
      currentAmount: 499.00,
      activeStudentLimit: 50,
    },
  });
  console.log(`✅ Created center: ${center.name} (${center.id})`);

  // Create admin user
  const adminHash = await hashPassword('admin123');
  const admin = await prisma.user.create({
    data: {
      centerId: center.id,
      role: 'CENTER_ADMIN',
      name: 'Admin User',
      email: 'admin@aba-demo.com',
      passwordHash: adminHash,
    },
  });
  console.log(`✅ Created admin: ${admin.email} / password: admin123`);

  // Create supervisor user
  const supervisorHash = await hashPassword('supervisor123');
  const supervisor = await prisma.user.create({
    data: {
      centerId: center.id,
      role: 'SUPERVISOR',
      name: 'Supervisor User',
      email: 'supervisor@aba-demo.com',
      passwordHash: supervisorHash,
    },
  });
  console.log(`✅ Created supervisor: ${supervisor.email} / password: supervisor123`);

  // Create therapist user
  const therapistHash = await hashPassword('therapist123');
  const therapist = await prisma.user.create({
    data: {
      centerId: center.id,
      role: 'THERAPIST',
      name: 'Therapist User',
      email: 'therapist@aba-demo.com',
      passwordHash: therapistHash,
    },
  });
  console.log(`✅ Created therapist: ${therapist.email} / password: therapist123`);

  // Create parent user
  const parentHash = await hashPassword('parent123');
  const parent = await prisma.user.create({
    data: {
      centerId: center.id,
      role: 'PARENT',
      name: 'Sarah Demo',
      email: 'parent@aba-demo.com',
      passwordHash: parentHash,
    },
  });
  console.log(`✅ Created parent: ${parent.email} / password: parent123`);

  // Create a demo student
  const student = await prisma.student.create({
    data: {
      centerId: center.id,
      name: 'Alex Demo',
      dateOfBirth: new Date('2018-05-15'),
      guardianName: 'Sarah Demo',
      guardianEmail: 'sarah@example.com',
    },
  });
  console.log(`✅ Created student: ${student.name}`);

  // Assign supervisor to student
  await prisma.studentSupervisor.create({
    data: { studentId: student.id, supervisorId: supervisor.id },
  });

  // Link parent to student
  await prisma.student.update({
    where: { id: student.id },
    data: { parentId: parent.id },
  });
  console.log(`✅ Linked parent ${parent.name} to student ${student.name}`);

  // Create a program with targets
  const program = await prisma.program.create({
    data: {
      studentId: student.id,
      createdById: supervisor.id,
      name: 'Color Identification',
      description: 'Identifying primary colors from a field of 3',
    },
  });

  await prisma.target.createMany({
    data: [
      {
        programId: program.id,
        domain: 'Receptive Language',
        skill: 'Identify Red',
        promptHierarchy: JSON.stringify(['FULL_PHYSICAL', 'PARTIAL_PHYSICAL', 'MODEL', 'VERBAL', 'GESTURAL', 'INDEPENDENT']),
        masteryPercentage: 80,
        masteryConsecutive: 3,
      },
      {
        programId: program.id,
        domain: 'Receptive Language',
        skill: 'Identify Blue',
        promptHierarchy: JSON.stringify(['FULL_PHYSICAL', 'PARTIAL_PHYSICAL', 'MODEL', 'VERBAL', 'GESTURAL', 'INDEPENDENT']),
        masteryPercentage: 80,
        masteryConsecutive: 3,
      },
      {
        programId: program.id,
        domain: 'Receptive Language',
        skill: 'Identify Yellow',
        promptHierarchy: JSON.stringify(['FULL_PHYSICAL', 'PARTIAL_PHYSICAL', 'MODEL', 'VERBAL', 'GESTURAL', 'INDEPENDENT']),
        masteryPercentage: 80,
        masteryConsecutive: 3,
      },
    ],
  });
  console.log(`✅ Created program: ${program.name} with 3 targets`);

  console.log('\n🎉 Seed complete!');
  console.log('---');
  console.log('Login credentials:');
  console.log('  Admin:      admin@aba-demo.com / admin123');
  console.log('  Supervisor: supervisor@aba-demo.com / supervisor123');
  console.log('  Therapist:  therapist@aba-demo.com / therapist123');
  console.log('  Parent:     parent@aba-demo.com / parent123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
