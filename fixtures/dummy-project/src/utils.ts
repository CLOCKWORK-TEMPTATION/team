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
