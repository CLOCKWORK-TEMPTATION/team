// This function is dead code and never exported or used
function calculateMath(a: number, b: number) {
  return a + b;
}

export function processUser(user: { name: string; age: number }) {
  // Duplicated code logic
  const formattedName = user.name.trim().toUpperCase();
  const isAdult = user.age >= 18;
  
  return {
    name: formattedName,
    isAdult
  };
}

export function processAdmin(admin: { name: string; age: number; role: string }) {
  // Duplicated code logic
  const formattedName = admin.name.trim().toUpperCase();
  const isAdult = admin.age >= 18;
  
  return {
    name: formattedName,
    isAdult,
    role: admin.role
  };
}

export const unusedExport = "This export is never imported anywhere";
