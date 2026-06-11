import { TwitterApi } from 'twitter-api-v2';
import { loadApiKeys } from '../../config/parser';

export async function manageTwitter(action: string, content?: string, username?: string): Promise<string> {
  try {
    const keys = await loadApiKeys();
    const bearerToken = keys['twitter_key'];
    
    if (!bearerToken) {
      return "Error: Twitter API Key not found. Please run 'nyxora set-key twitter <BEARER_TOKEN>'";
    }

    // Initialize Read-Only or OAuth2 client (simplified for this module)
    // Assuming Bearer Token for read, or User Context for write if they provided OAuth 1.0 keys combined
    // For a real production app, we might need OAuth 1.0a keys for posting.
    // For now, we simulate the structure.
    const client = new TwitterApi(bearerToken);
    const readOnlyClient = client.readOnly;

    if (action === 'get_tweets') {
      if (!username) return "Error: username is required for get_tweets";
      const user = await readOnlyClient.v2.userByUsername(username);
      if (!user.data) return `Error: User ${username} not found.`;
      
      const tweets = await readOnlyClient.v2.userTimeline(user.data.id, { max_results: 5 });
      let result = `--- Last 5 Tweets from @${username} ---\n`;
      for (const tweet of tweets.data.data) {
        result += `- ${tweet.text}\n`;
      }
      return result;
      
    } else if (action === 'post_tweet') {
      if (!content) return "Error: content is required to post a tweet";
      // This requires User Context auth (OAuth 1.0a or OAuth2 user token).
      // If the user provided a bearer token, it might fail for posting.
      // We wrap it in a try-catch explaining this.
      try {
        const tweet = await client.v2.tweet(content);
        return `Success: Tweet posted with ID ${tweet.data.id}`;
      } catch (e: any) {
        return `Failed to post tweet. Make sure your twitter_key contains valid OAuth 1.0a User Context credentials, not just a App Bearer Token. Error: ${e.message}`;
      }
    }

    return `Error: Unsupported action ${action}`;
  } catch (error: any) {
    return `Twitter API Error: ${error.message}`;
  }
}

export const xManagerToolDefinition = {
  type: "function",
  function: {
    name: "manage_twitter",
    description: "Reads tweets from Web3 influencers or posts updates to X/Twitter.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get_tweets", "post_tweet"],
          description: "The action to perform.",
        },
        content: {
          type: "string",
          description: "The text to tweet. Required for 'post_tweet'.",
        },
        username: {
          type: "string",
          description: "The X username (without @) to fetch tweets from. Required for 'get_tweets'.",
        }
      },
      required: ["action"],
    },
  },
};
