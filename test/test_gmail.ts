import { readGmailInbox } from './packages/core/src/system/skills/googleWorkspace';
import { initGoogleAuth } from './packages/core/src/gateway/googleAuthModule';

async function test() {
  await initGoogleAuth();
  const res = await readGmailInbox(5);
  console.log(res);
}
test();
