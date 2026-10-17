import { fileURLToPath } from 'node:url';
import { createApp, readConfig } from './app.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
try {
  const config = readConfig(process.env, root);
  for (const warning of config.warnings) console.warn(`Note: ${warning}`);
  const server = createApp(config, { log: line => console.log(`[${new Date().toISOString()}] ${line}`) });
  server.on('error', error => {
    console.error((error as NodeJS.ErrnoException).code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Set PORT in .env to another value.` : 'Could not start the server.');
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : config.port;
    const coaches = (Object.entries({ 'Claude API': config.anthropic.key, 'OpenAI API': config.openai.key, 'Claude Code CLI': config.claude.binary, 'Codex CLI': config.codex.binary }) as [string, string][]).filter(([, value]) => value).map(([name]) => name);
    console.log(`Icarus is running at http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${port}`);
    console.log(`Coaches available: Icarus Offline${coaches.length ? `, ${coaches.join(', ')}` : ' (add an API key in .env for AI coaching)'}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid configuration.');
  process.exitCode = 1;
}
