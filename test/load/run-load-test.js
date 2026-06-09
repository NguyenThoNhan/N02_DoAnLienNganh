const autocannon = require('autocannon');

const target = process.env.LOAD_TEST_URL || 'http://localhost:5000/';
const connections = Number(process.env.LOAD_TEST_CONN || 50);
const duration = Number(process.env.LOAD_TEST_DURATION || 20);
const pipelining = Number(process.env.LOAD_TEST_PIPE || 1);

console.log('='.repeat(72));
console.log('TECHCARE LOAD TEST');
console.log('='.repeat(72));
console.log(`Target        : ${target}`);
console.log(`Connections   : ${connections}`);
console.log(`Duration (s)  : ${duration}`);
console.log(`Pipelining    : ${pipelining}`);
console.log('-'.repeat(72));
console.log('Starting load test...\n');

const instance = autocannon({
  url: target,
  connections,
  duration,
  pipelining,
  method: 'GET',
  timeout: 10
}, (err, result) => {
  if (err) {
    console.error('\nLoad test failed:', err.message);
    process.exitCode = 1;
    return;
  }
  console.log('\n' + '='.repeat(72));
  console.log('SUMMARY');
  console.log('='.repeat(72));
  console.log(`Requests/sec (avg) : ${Number(result.requests.average || 0).toFixed(2)}`);
  console.log(`Latency p99 (ms)   : ${Number(result.latency.p99 || 0).toFixed(2)}`);
  console.log(`Throughput (MB/s)  : ${Number((result.throughput.average || 0) / 1024 / 1024).toFixed(2)}`);
  console.log(`Total requests     : ${result.requests.total || 0}`);
  console.log(`Total errors       : ${result.errors || 0}`);
  console.log(`Total timeouts     : ${result.timeouts || 0}`);
  console.log('='.repeat(72));
});

autocannon.track(instance, { renderProgressBar: true, renderResultsTable: true });
