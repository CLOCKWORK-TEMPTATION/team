import { processUser, processAdmin } from './index.js';
import { formatDate } from './utils.js';

const user = processUser({ name: " John Doe ", age: 25 });
const admin = processAdmin({ name: " Jane Admin ", age: 30, role: "superuser" });

console.log(`User created on ${formatDate(new Date())}`, user);
console.log(`Admin created on ${formatDate(new Date())}`, admin);
