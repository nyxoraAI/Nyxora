import { runSetupWizard } from './setup';
import * as process from 'process';

runSetupWizard().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
