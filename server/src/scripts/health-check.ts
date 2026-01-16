async function healthCheck() {
  const url = 'http://localhost:3000/api/health';

  try {
    console.log(`Checking health at ${url}...`);

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok && data.status === 'ok') {
      console.log('\n✓ Health check PASSED');
      console.log(`  Status: ${data.status}`);
      console.log(`  Timestamp: ${data.timestamp}`);
      process.exit(0);
    } else {
      console.log('\n✗ Health check FAILED');
      console.log(`  Response: ${JSON.stringify(data)}`);
      process.exit(1);
    }
  } catch (error) {
    console.log('\n✗ Health check FAILED');
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

healthCheck();
