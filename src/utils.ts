export async function wait(durationInSeconds = 2) {
  return new Promise((resolve) =>
    setTimeout(resolve, durationInSeconds * 1000)
  );
}

export async function runScript(
  runnableScript: (() => Promise<any>) | (() => any)
): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('Running script...');
    await runnableScript();

    console.log(`Done in: ${(Date.now() - startTime) / 1000} seconds`);
    console.log('Exiting successfully.');
    process.exit(0);
  } catch (error) {
    console.error('An error occurred:', error);

    console.log(`Ran for: ${(Date.now() - startTime) / 1000} seconds`);
    process.exit(1);
  }
}
