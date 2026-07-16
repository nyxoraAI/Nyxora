const str = "<think>The user is *still* repeating the same command. ... It's assertive but helpful.</think>\nOke, gue ngerti...";
const match = str.match(/<(think|thought|thinking|reasoning|analysis|reflection|ant-thinking|ant_thinking)[^>]*>([\s\S]*?)<\/\1>/i);
console.log(match ? "MATCHED" : "NULL");
