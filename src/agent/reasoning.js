"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processUserInput = processUserInput;
const openai_1 = require("openai");
const parser_1 = require("../config/parser");
const logger_1 = require("../memory/logger");
const getBalance_1 = require("../web3/skills/getBalance");
const config = (0, parser_1.loadConfig)();
const logger = new logger_1.Logger();
// Initialize OpenAI client
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const systemPrompt = `You are an autonomous Web3 agent operating on EVM chains.
Your wallet address is available via the tools. 
Always use the tools to interact with the blockchain.
If the user doesn't specify a chain, default to: ${config.agent.default_chain}.`;
async function processUserInput(input) {
    // Add user input to memory
    logger.addEntry({ role: 'user', content: input });
    const history = logger.getHistory();
    // Format messages for OpenAI
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(m => {
            const msg = { role: m.role, content: m.content || "" };
            if (m.name)
                msg.name = m.name;
            if (m.tool_call_id)
                msg.tool_call_id = m.tool_call_id;
            if (m.tool_calls)
                msg.tool_calls = m.tool_calls;
            return msg;
        })
    ];
    try {
        if (config.llm.provider !== 'openai') {
            return `Provider ${config.llm.provider} is configured, but currently only OpenAI adapter is fully implemented in this demo.`;
        }
        const response = await openai.chat.completions.create({
            model: config.llm.model,
            temperature: config.llm.temperature,
            messages: messages,
            tools: [getBalance_1.getBalanceToolDefinition],
            tool_choice: "auto",
        });
        const responseMessage = response.choices[0].message;
        // Log assistant response
        logger.addEntry({
            role: 'assistant',
            content: responseMessage.content || "",
            tool_calls: responseMessage.tool_calls,
        });
        // Check if the model wants to call a tool
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.function.name === 'get_balance') {
                    const args = JSON.parse(toolCall.function.arguments);
                    const balanceResult = await (0, getBalance_1.getBalance)(args.chainName, args.address);
                    logger.addEntry({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: balanceResult,
                    });
                }
            }
            // Second call to get the final answer after tool execution
            const secondMessages = [
                { role: 'system', content: systemPrompt },
                ...logger.getHistory().map(m => {
                    const msg = { role: m.role, content: m.content || "" };
                    if (m.name)
                        msg.name = m.name;
                    if (m.tool_call_id)
                        msg.tool_call_id = m.tool_call_id;
                    if (m.tool_calls)
                        msg.tool_calls = m.tool_calls;
                    return msg;
                })
            ];
            const secondResponse = await openai.chat.completions.create({
                model: config.llm.model,
                messages: secondMessages,
            });
            const finalContent = secondResponse.choices[0].message.content || "";
            logger.addEntry({ role: 'assistant', content: finalContent });
            return finalContent;
        }
        return responseMessage.content || "No response generated.";
    }
    catch (error) {
        console.error("LLM Error:", error);
        return `Error connecting to AI Provider: ${error.message}`;
    }
}
//# sourceMappingURL=reasoning.js.map