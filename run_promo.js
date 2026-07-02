const { PromotionEngine } = require('./packages/core/dist/memory/promotionEngine.js');
PromotionEngine.runPromotionAndDecay().then(() => console.log('Done')).catch(console.error);
