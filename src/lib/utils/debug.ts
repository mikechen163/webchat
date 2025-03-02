const DEBUG = true;

export function debug(context: string, ...args: any[]) {
  if (DEBUG) {
    console.log(`[DEBUG:${context}]`, ...args);
  }
}
