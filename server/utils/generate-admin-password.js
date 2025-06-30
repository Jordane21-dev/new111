import bcrypt from 'bcryptjs';

// Function to generate hashed password for admin
async function generateAdminPassword() {
  const plainPassword = 'admin123'; // Change this to your desired password
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  
  console.log('Plain password:', plainPassword);
  console.log('Hashed password:', hashedPassword);
  console.log('\nUse this hashed password in your SQL INSERT query:');
  console.log(`'${hashedPassword}'`);
}

// Run the function
generateAdminPassword().catch(console.error);