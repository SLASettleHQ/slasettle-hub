#!/usr/bin/env node
// Fails fast with a clear, actionable message when the active Node version
// doesn't meet this project's requirement (see .nvmrc / each package.json's
// "engines"), instead of letting a stale Node crash later with an obscure
// error from deep inside a dependency (e.g. undici calling a
// worker_threads API that only exists on Node 24+).

const REQUIRED_MAJOR = 24;
const actualMajor = Number(process.versions.node.split(".")[0]);

if (actualMajor < REQUIRED_MAJOR) {
  console.error(
    `\nThis project requires Node ${REQUIRED_MAJOR}+ (see .nvmrc). ` +
      `Current: ${process.version}.\nRun "nvm use" (or otherwise switch to ` +
      `Node ${REQUIRED_MAJOR}+) before running this command.\n`,
  );
  process.exit(1);
}
