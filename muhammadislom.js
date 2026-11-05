'use strict';


import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const TelegramBotImport = require('node-telegram-bot-api');
const TelegramBot = TelegramBotImport.default || TelegramBotImport;



const BOT_TOKEN = '8805757650:AAHzG4_CNiri-oS4uujtSFYqG5nHGxl5i5o';
const ADMIN_ID = '6837105378';
const ADMIN_USERNAME = '@Orginal_parfyum_2024';

const WELCOME_PHOTO =
  'https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=1080&q=80';

const WELCOME_CAPTION =
  "Assalomu aleykum hurmatli mijoz! Bizning perfume do'konimizga xush kelibsiz. O'zingizga ma'qul kelgan brendni tanlang:";

const ADMIN_URL = `https://t.me/${ADMIN_USERNAME.replace('@', '')}`;
const BRAND_COLUMNS = 2;
const SESSION_TTL_MS = 30 * 60 * 1000;

const BUTTONS = Object.freeze({
  SHARE_CONTACT: '📱 Telefon raqamni yuborish',
  CANCEL: '❌ Bekor qilish',
  ADMIN: "👨‍💻 Admin bilan bog'lanish",
  ORDER: '🛍 Zakaz berish',
});




const DEFAULT_PRODUCT_PHOTO =
  'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1080&q=80';


const PRODUCTS = [
  { name: '13 TALIK PROFESSIONAL MAKIAJ KISTLARI', price: '60 000 som ', photo: './images/5316680964673054627.jpg' },
  { name: 'soch tokilishiga qarshi qora sedana', price: '160 000 som', photo: './images/5319226892437102870.jpg' },
  { name: 'Lagom yuz parvarish qilish uchun', price: '800 000 som', photo: './images/5319226892437102876.jpg' },
  { name: 'Yuz va qol uchun kasmetikalar to‘plami', price: '190 000 som', photo: './images/5319226892437102877.jpg' },
  { name: 'Amerat al atri atiga', price: '200 000 som', photo: './images/5319226892437102879.jpg' },
  { name: '4talik nabor', price: '350 000 som', photo: './images/5319226892437102905.jpg' },
  { name: 'Apres amour ', price: '1 700 000 som', photo: './images/5319226892437102909.jpg' },
  { name: 'Yuzdagi ajinlarga qarshi', price: '280 000 som', photo: './images/5321478692250786866.jpg' },
  { name: 'Diyor kosmetik nabori', price: '345 000 som', photo: './images/5321478692250786872.jpg' },
  { name: 'Emalie kosmetika nabori', price: '260 000 som', photo: './images/5321478692250786877.jpg' },
  { name: 'Emalie kosmetika', price: '260 000 som', photo: './images/5321478692250786879.jpg' },
];



const log = {
  info: (msg, ...rest) => console.log(`[${new Date().toISOString()}] [INFO]  ${msg}`, ...rest),
  warn: (msg, ...rest) => console.warn(`[${new Date().toISOString()}] [WARN]  ${msg}`, ...rest),
  error: (msg, err) =>
    console.error(
      `[${new Date().toISOString()}] [ERROR] ${msg}`,
      err && err.stack ? `\n${err.stack}` : err || ''
    ),
};



if (!BOT_TOKEN || BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') {
  log.error('BOT_TOKEN is not configured.');
  process.exit(1);
}



const bot = new TelegramBot(BOT_TOKEN, { polling: true });


const pendingOrders = new Map();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [userId, order] of pendingOrders) {
    if (now - order.createdAt > SESSION_TTL_MS) pendingOrders.delete(userId);
  }
}, 5 * 60 * 1000);
cleanupTimer.unref();



const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const chunk = (arr, size) => {
  const rows = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
};

const safe = (name, handler) => async (...args) => {
  try {
    await handler(...args);
  } catch (err) {
    log.error(`Unhandled error in "${name}" handler`, err);
  }
};

const formatCustomerName = (user) => {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  const username = user.username ? `@${user.username}` : '';
  if (fullName && username) return `${fullName} (${username})`;
  return fullName || username || "Noma'lum";
};

const normalizePhone = (phone) => {
  const value = String(phone || '').trim();
  return value.startsWith('+') ? value : `+${value}`;
};



const buildMainMenu = () => {
  const brandButtons = PRODUCTS.map((item, index) => ({
    text: item.name,
    callback_data: `view:${index}`,
  }));

  const inline_keyboard = chunk(brandButtons, BRAND_COLUMNS);
  inline_keyboard.push([{ text: BUTTONS.ADMIN, url: ADMIN_URL }]);

  return { inline_keyboard };
};

const buildOrderKeyboard = (index) => ({
  inline_keyboard: [
    [{ text: BUTTONS.ORDER, callback_data: `order:${index}` }],
    [{ text: BUTTONS.ADMIN, url: ADMIN_URL }],
  ],
});


const buildContactKeyboard = () => ({
  keyboard: [
    [{ text: BUTTONS.SHARE_CONTACT, request_contact: true }],
    [{ text: BUTTONS.CANCEL }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
  persistent: true
});

const buildAdminOnlyMarkup = () => ({
  inline_keyboard: [[{ text: BUTTONS.ADMIN, url: ADMIN_URL }]],
});



async function sendMainMenu(chatId) {
  const reply_markup = buildMainMenu();

  try {
    await bot.sendPhoto(chatId, WELCOME_PHOTO, { caption: WELCOME_CAPTION, reply_markup });
  } catch (err) {
    log.error('sendPhoto failed, falling back to text welcome', err);
    await bot.sendMessage(chatId, WELCOME_CAPTION, { reply_markup });
  }
}

async function notifyAdmin({ user, phone, brand, price }) {
  const text = [
    '🛍 NEW ORDER RECEIVED!',
    '',
    `👤 Customer: ${formatCustomerName(user)}`,
    `📞 Phone: ${normalizePhone(phone)}`,
    `🆔 Telegram ID: ${user.id}`,
    `📦 Selected Brand: ${brand}`,
    `💵 Price: ${price}`,
  ].join('\n');

  await bot.sendMessage(ADMIN_ID, text);
}




bot.onText(
  /^\/start(?:@\w+)?(?:\s|$)/,
  safe('/start', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.from) pendingOrders.delete(msg.from.id);

    await sendMainMenu(chatId);
    log.info(`/start from ${msg.from ? msg.from.id : chatId}`);
  })
);


bot.on(
  'callback_query',
  safe('callback_query', async (query) => {
    const { id: queryId, data, from, message } = query;
    if (!data || !message) return;

    
    if (data.startsWith('view:')) {
      const index = Number(data.slice('view:'.length));
      const item = PRODUCTS[index];

      if (!item) {
        await bot.answerCallbackQuery(queryId, { text: "Mahsulot topilmadi." });
        return;
      }

      await bot.answerCallbackQuery(queryId);

      const photoUrl =
        item.photo && item.photo !== 'YOUR_PHOTO_URL_HERE'
          ? item.photo
          : DEFAULT_PRODUCT_PHOTO;

      const caption =
        `✨ <b>${escapeHtml(item.name)}</b>\n\n` +
        `💵 Narxi: <b>${escapeHtml(item.price)}</b>\n\n` +
        `Buyurtma berish uchun pastdagi tugmani bosing 👇`;

      try {
        await bot.sendPhoto(message.chat.id, photoUrl, {
          caption,
          parse_mode: 'HTML',
          reply_markup: buildOrderKeyboard(index),
        });
      } catch (err) {
        log.error('Failed to send product photo', err);
        await bot.sendMessage(message.chat.id, caption, {
          parse_mode: 'HTML',
          reply_markup: buildOrderKeyboard(index),
        });
      }
      return;
    }

    
    if (data.startsWith('order:')) {
      const index = Number(data.slice('order:'.length));
      const item = PRODUCTS[index];

      if (!item) {
        await bot.answerCallbackQuery(queryId, { text: "Mahsulot topilmadi." });
        return;
      }

      pendingOrders.set(from.id, { brand: item.name, price: item.price, createdAt: Date.now() });
      await bot.answerCallbackQuery(queryId, { text: `✅ ${item.name}` });

    
      await bot.sendMessage(
        message.chat.id,
        `✅ Siz <b>${escapeHtml(item.name)}</b> (${escapeHtml(item.price)}) mahsulotini tanladingiz.\n\n` +
          'Buyurtmani tasdiqlash uchun pastdagi tugma orqali telefon raqamingizni yuboring va biz sizga aloqaga chiqamiz  👇',
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              [{ text: BUTTONS.SHARE_CONTACT, request_contact: true }],
              [{ text: BUTTONS.CANCEL }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
      log.info(`User ${from.id} initiated order for: ${item.name}`);
      return;
    }
  })
);


bot.on(
  'contact',
  safe('contact', async (msg) => {
    const { contact, from, chat } = msg;
    if (!contact || !from) return;

    if (contact.user_id && contact.user_id !== from.id) {
      await bot.sendMessage(
        chat.id,
        "⚠️ Iltimos, faqat o'zingizning raqamingizni yuboring.",
        { reply_markup: buildContactKeyboard() }
      );
      return;
    }

    const order = pendingOrders.get(from.id);
    if (!order) {
      await bot.sendMessage(chat.id, 'Avval brendni tanlang 👇', {
        reply_markup: { remove_keyboard: true },
      });
      await sendMainMenu(chat.id);
      return;
    }

    try {
      await notifyAdmin({
        user: from,
        phone: contact.phone_number,
        brand: order.brand,
        price: order.price,
      });
    } catch (err) {
      log.error(`Failed to deliver order alert to admin`, err);
      await bot.sendMessage(
        chat.id,
        "😔 Buyurtmani yuborishda xatolik yuz berdi. Bir ozdan so'ng qayta urinib ko'ring.",
        { reply_markup: { remove_keyboard: true } }
      );
      await bot.sendMessage(chat.id, 'Admin:', { reply_markup: buildAdminOnlyMarkup() });
      return;
    }

    pendingOrders.delete(from.id);

    await bot.sendMessage(
      chat.id,
      `🎉 Rahmat! <b>${escapeHtml(order.brand)}</b> (${escapeHtml(order.price)}) bo'yicha buyurtmangiz qabul qilindi.\n` +
        "Tez orada admin siz bilan bog'lanadi.",
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
    await bot.sendMessage(chat.id, "Savollaringiz bo'lsa, admin bilan bog'lanishingiz mumkin 👇", {
      reply_markup: buildAdminOnlyMarkup(),
    });

    log.info(`Order completed: user ${from.id}, brand ${order.brand}`);
  })
);


bot.on(
  'message',
  safe('message', async (msg) => {
    if (!msg.text || !msg.from || msg.text.startsWith('/')) return;

    if (msg.text === BUTTONS.CANCEL) {
      pendingOrders.delete(msg.from.id);
      await bot.sendMessage(msg.chat.id, 'Buyurtma bekor qilindi.', {
        reply_markup: { remove_keyboard: true },
      });
      await sendMainMenu(msg.chat.id);
      return;
    }

    if (pendingOrders.has(msg.from.id)) {
      await bot.sendMessage(
        msg.chat.id,
        `Buyurtmani tasdiqlash uchun "${BUTTONS.SHARE_CONTACT}" tugmasini bosing.`,
        { reply_markup: buildContactKeyboard() }
      );
      return;
    }

    await sendMainMenu(msg.chat.id);
  })
);



bot.on('polling_error', (err) => log.error('Polling error', err));
bot.on('error', (err) => log.error('Bot error', err));

process.on('unhandledRejection', (reason) => log.error('Unhandled promise rejection', reason));
process.on('uncaughtException', (err) => log.error('Uncaught exception', err));

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info(`${signal} received — shutting down...`);
  try {
    await bot.stopPolling();
  } catch (err) {
    log.error('Error while stopping polling', err);
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

log.info(`Perfume boutique bot started (${PRODUCTS.length} products loaded).`);