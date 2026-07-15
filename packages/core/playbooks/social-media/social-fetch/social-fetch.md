# Social Fetch API Playbook

This playbook provides standard operating procedures (SOP) for the AI agent to fetch real-time social media data (Twitter, TikTok, Instagram, YouTube) via the Social Fetch API.

## 1. Security & Authentication
**CRITICAL**: You MUST authenticate all requests using the `SOCIALFETCH_API_KEY`.
- The key is stored in the user's secure configuration directory: `~/.nyxora/playbooks/social-media/social-fetch/.env`.
- Before making any API calls, always execute a bash command to read the key:
  ```bash
  source ~/.nyxora/playbooks/social-media/social-fetch/.env && echo $SOCIALFETCH_API_KEY
  ```
- Use this key in the `X-Api-Key` header of your `curl` requests.

## 2. Execution Logic
To perform a social fetch, use the `run_command` tool to execute a `curl` request.
Example format:
```bash
curl -G "https://api.socialfetch.dev/v1/twitter/profiles/elonmusk" \
  -H "X-Api-Key: YOUR_API_KEY"
```
For endpoints with search parameters:
```bash
curl -G "https://api.socialfetch.dev/v1/twitter/search" \
  --data-urlencode "query=base airdrop" \
  -H "X-Api-Key: YOUR_API_KEY"
```

## 3. Supported Endpoints Catalog

### 🐦 Twitter (X)
*   **Profile**: `GET /v1/twitter/profiles/{handle}`
*   **Profile Tweets**: `GET /v1/twitter/profiles/{handle}/tweets`
*   **Single Tweet**: `GET /v1/twitter/tweets/{id}`
*   **Tweet Replies**: `GET /v1/twitter/tweets/{id}/replies`
*   **Search Tweets**: `GET /v1/twitter/search?query={query}`
*   **Hashtag Search**: `GET /v1/twitter/hashtags/{hashtag}`

### 🎵 TikTok
*   **Profile**: `GET /v1/tiktok/profiles/{handle}`
*   **Profile Videos**: `GET /v1/tiktok/profiles/{handle}/videos`
*   **Search Users**: `GET /v1/tiktok/search/users?query={query}`
*   **Search Videos**: `GET /v1/tiktok/search/videos?query={query}`
*   **Trending Feed**: `GET /v1/tiktok/feed/trending`

### 📸 Instagram
*   **Profile**: `GET /v1/instagram/profiles/{handle}`
*   **Profile Posts**: `GET /v1/instagram/profiles/{handle}/posts`
*   **Profile Reels**: `GET /v1/instagram/profiles/{handle}/reels`
*   **Search Reels**: `GET /v1/instagram/search/reels?query={query}`

### 📺 YouTube
*   **Channel**: `GET /v1/youtube/channels/{handle}`
*   **Channel Videos**: `GET /v1/youtube/channels/{handle}/videos`
*   **Channel Shorts**: `GET /v1/youtube/channels/{handle}/shorts`
*   **Search**: `GET /v1/youtube/search?query={query}`

## 4. Output Parsing
After receiving the JSON response via `run_command`:
1. Do NOT dump the raw JSON to the user.
2. Analyze the JSON structure.
3. Extract the relevant fields (e.g., follower count, tweet text, video views).
4. Summarize the findings clearly in the chat channel.
