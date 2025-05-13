import { config } from "dotenv";
config();

import { Telegraf, Scenes, session } from "telegraf";
import mongoose from "mongoose";


const appointmentSchema = new mongoose.Schema({
  fullName: String,
  address: String,
  weekday: String,
  chatId: Number,
  createdAt: { type: Date, default: Date.now },
});

const Appointment = mongoose.model("Appointment", appointmentSchema);


const appointmentWizard = new Scenes.WizardScene(
  "appointment-wizard",

  (ctx) => {
    ctx.reply("Iltimos, to‘liq ismingizni kiriting:");
    ctx.wizard.state.data = {};
    return ctx.wizard.next();
  },

  (ctx) => {
    ctx.wizard.state.data.fullName = ctx.message.text;
    ctx.reply("Manzilni kiriting:");
    return ctx.wizard.next();
  },

  (ctx) => {
    ctx.wizard.state.data.address = ctx.message.text;
    ctx.reply("Qaysi kunga yozilmoqchisiz?", {
      reply_markup: {
        keyboard: [
          ["Dushanba", "Seshanba"],
          ["Chorshanba", "Payshanba"],
          ["Juma", "Shanba", "Yakshanba"],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return ctx.wizard.next();
  },

  (ctx) => {
    ctx.wizard.state.data.weekday = ctx.message.text;

    const { fullName, address, weekday } = ctx.wizard.state.data;

    ctx.reply(
      `✅ Uchrashuv ma'lumotlari:\n\n👤 Ism: ${fullName}\n📍 Manzil: ${address}\n📅 Kuni: ${weekday}\n\nBarchasi to‘g‘rimi?`,
      {
        reply_markup: {
          keyboard: [["✅ Ha", "❌ Bekor qilish"]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
    return ctx.wizard.next();
  },

  async (ctx) => {
    if (ctx.message.text === "✅ Ha") {
      const { fullName, address, weekday } = ctx.wizard.state.data;

      await Appointment.create({
        fullName,
        address,
        weekday,
        chatId: ctx.chat.id,
      });

      await ctx.reply("✅ Uchrashuv saqlandi!");
      await ctx.telegram.sendMessage(
        process.env.ADMIN_CHAT_ID,
        `📥 Yangi uchrashuv:\n\n👤 ${fullName}\n📍 ${address}\n📅 ${weekday}`
      );
    } else {
      await ctx.reply("❌ Uchrashuv bekor qilindi.");
    }

    return ctx.scene.leave();
  }
);


const bot = new Telegraf(process.env.BOT_TOKEN);
const stage = new Scenes.Stage([appointmentWizard]);

bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => {
  ctx.reply("👋 Salom! Quyidagi menyudan foydalaning:", {
    reply_markup: {
      keyboard: [["📅 Yangi uchrashuv", "🗓 Uchrashuvlarim"], ["📞 Bog‘lanish"]],
      resize_keyboard: true,
    },
  });
});

bot.hears("📅 Yangi uchrashuv", (ctx) => ctx.scene.enter("appointment-wizard"));

bot.hears("🗓 Uchrashuvlarim", async (ctx) => {
  const list = await Appointment.find({ chatId: ctx.chat.id });

  if (list.length === 0) {
    return ctx.reply("Sizda hali uchrashuvlar yo‘q.");
  }

  let text = "🗓 Sizning uchrashuvlaringiz:\n\n";
  list.forEach((a, i) => {
    text += `${i + 1}. ${a.fullName} — ${a.weekday} (${a.address})\n`;
  });

  ctx.reply(text);
});

bot.hears("📞 Bog‘lanish", (ctx) => {
  ctx.reply("Bog‘lanish uchun: @baxtiyarovich_0102 yoki +998 93 164 64 79");
});


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB ulandi");
    bot.launch();
    console.log("🤖 Bot ishga tushdi");
  })
  .catch((err) => {
    console.error("❌ MongoDB ulanishda xatolik:", err);
  });
