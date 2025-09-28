require('dotenv').config();
const axios = require('axios');

// === 读取环境变量 ===
const BEARER_TOKEN = process.env.BEARER_TOKEN;
const COOKIE = process.env.COOKIE;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const latitude = parseFloat(process.env.LATITUDE);
const longitude = parseFloat(process.env.LONGITUDE);
const STORES = JSON.parse(process.env.STORES);

// 保存上一次库存状态
const lastStock = {};
let firstRun = true;

// ==== 调用TooGoodToGo API ====
async function checkStore(store) {
  try {
    const apiurl = `https://apptoogoodtogo.com/api/item/v9/${store.id}`;
    const body = {
        "origin": {latitude, longitude}
    }
    const response = await axios.post(apiurl, body, {
      headers: {
        'Host': 'apptoogoodtogo.com',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-TimezoneOffset': '+10:00',
        'X-Correlation-Id': 'FA88D40B-DC14-403B-A171-4866401E5AB7',
        'Accept-Language': 'en-AU',
        'User-Agent': 'TooGoodToGo/25.9.10 (2934.0) (iPhone/iPhone 14 Pro; iOS 18.7; Scale/3.00/iOS)',
        'X-24HourFormat': 'true',
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Cookie': COOKIE,
      }
    });

    const data = response.data;
    console.log('库存数据:', data);
    const {items_available} = {...data};
    
    // 首次运行或者库存变化才发送消息
    if (firstRun || lastStock[store.id] !== items_available) {
      lastStock[store.id] = items_available; // 更新缓存
      const msg = `${data.store.store_name}剩余: ${items_available}`;
      console.log(lastStock);
      return msg;
    } else {
      return null;
    }

  } catch (error) {
    console.error(`查询 ${store.name} 出错:`, error.message);
    console.error(error)
    return `${store.name} 查询失败`;
  }
}

// ==== 发送消息到 Telegram ====
async function sendTelegramMessage(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Telegram发送失败:', error.message, error);
  }
}

// --- 每分钟执行一次 ---
async function checkAllStores() {
  for (const store of STORES) {
    const message = await checkStore(store);
    if (message) {
      console.log(message);
      await sendTelegramMessage(message);
    }
  }

  if (firstRun) firstRun = false; // 执行完一次后关闭首次标记
}

// 启动定时任务
checkAllStores(); // 立即执行一次
setInterval(checkAllStores, 60 * 1000); // 每分钟执行一次
