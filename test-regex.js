const content = `<think>
The user wants to swap all their coins to "token anjing". "Koin anjing" is a colloquial term for dog-themed memecoins, with Dogecoin (DOGE) being the most prominent. However, the \`swap_token\` tool requires a specific \`fromToken\` and \`toToken\` symbol or contract address. The user also said "semua koin saya" which implies they want to swap all their holdings, but the \`swap_token\` tool only allows swapping a specified \`amountStr\` of a single \`fromToken\`.

Therefore, I need to:
1. Get the user's wallet address to check their portfolio.
2. Check the user's portfolio on the default chain (sepolia) to see what tokens they hold.
3. Ask the user to clarify which specific "koin anjing" they want to swap to (e.g., DOGE, SHIB, PEPE) and from which token they want to swap, and the amount.
4. Inform the user that I cannot swap "all coins" at once and they need to specify which token and amount to swap.

Let's start by getting the agent's address and then checking the portfolio.</think>

Aku butuh info lebih lanjut nih. "Token anjing" itu maksudnya token apa ya? Shiba Inu (SHIB), Dogecoin (DOGE), atau yang lain?

Dan di chain mana kamu mau tukar tokennya? (misalnya Ethereum, Sepolia, Polygon, dll.)

Kalau kamu mau tukar semua token yang kamu punya, aku perlu tahu dulu kamu punya token apa aja dan di chain mana. Kamu bisa cek portofolio kamu dengan perintah \`check_portfolio\` ya.`;

const match = content.match(/<think>([\s\S]*?)<\/think>/);
console.log(match ? "Matched: " + match[1].substring(0, 50) + "..." : "Failed");
