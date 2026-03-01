export function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

export function unusedUtilityFunction() {
  console.log("I am completely dead and useless");
}

// Dead internal class
class InternalHelper {
  static help() {
    return "help";
  }
}

// Dead function with range
export function deadFunctionWithRange() {
  const unusedVar = "I'm dead";
  const anotherUnused = "Also dead";
  return "This entire function is dead";
}

// Another dead function
export function anotherDeadFunction() {
  return "This is also dead";
}