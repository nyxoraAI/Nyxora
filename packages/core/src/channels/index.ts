import { channelManager } from './ChannelManager';
import { adapter as whatsappAdapter } from './whatsappAdapter';
import { adapter as slackAdapter } from './slackAdapter';
import { adapter as lineAdapter } from './lineAdapter';
import { adapter as msteamsAdapter } from './msteamsAdapter';
import { adapter as mattermostAdapter } from './mattermostAdapter';
import { adapter as matrixAdapter } from './matrixAdapter';
import { adapter as googlechatAdapter } from './googlechatAdapter';
import { adapter as zaloAdapter } from './zaloAdapter';
import { adapter as twitchAdapter } from './twitchAdapter';
import { adapter as imessageAdapter } from './imessageAdapter';
import { adapter as smsAdapter } from './smsAdapter';
import { adapter as voicecallAdapter } from './voicecallAdapter';
import { adapter as ircAdapter } from './ircAdapter';
import { adapter as qqbotAdapter } from './qqbotAdapter';
import { adapter as nostrAdapter } from './nostrAdapter';
import { adapter as synologychatAdapter } from './synologychatAdapter';
import { adapter as nextcloudtalkAdapter } from './nextcloudtalkAdapter';

channelManager.register(whatsappAdapter);
channelManager.register(slackAdapter);
channelManager.register(lineAdapter);
channelManager.register(msteamsAdapter);
channelManager.register(mattermostAdapter);
channelManager.register(matrixAdapter);
channelManager.register(googlechatAdapter);
channelManager.register(zaloAdapter);
channelManager.register(twitchAdapter);
channelManager.register(imessageAdapter);
channelManager.register(smsAdapter);
channelManager.register(voicecallAdapter);
channelManager.register(ircAdapter);
channelManager.register(qqbotAdapter);
channelManager.register(nostrAdapter);
channelManager.register(synologychatAdapter);
channelManager.register(nextcloudtalkAdapter);

// Note: telegram and discord adapters will be registered later once refactored to implement ChannelAdapter.

export { channelManager };
