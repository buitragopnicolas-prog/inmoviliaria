import { takeCoverage } from 'node:v8';

// Only imported by the disposable server launched with Node's IPC channel.
process.on('message', message => {
  if(message === 'finish-disposable-test') {
    if(process.env.NODE_V8_COVERAGE) takeCoverage();
    process.exit(0);
  }
});
