# WealthFlow — Telegram Quick Note bot

Quick Note වගේම: Telegram එකෙන් එවන හැම entry එකක්ම **Draft** එකක් විදිහට `SMS Imports` (Draft Inbox) එකට වැටෙනවා.
Bot එක කිසිම transaction එකක් හදන්නේ නැහැ, balance වලට අත ගහන්නෙත් නැහැ - Confirm කරන්නේ app එකේදී.

## භාවිතය
`1500 dry food` · `2000 LKR salary` · `50 ILS taxi` එවන්න → බොත්තම් වලින්
**Income/Expense → කරන්සිය → ගිණුම → ප්‍රවර්ගය (+ උප ප්‍රවර්ගය) → Save as draft**.
(ඔබ ගාව කරන්සි එකක් විතරක්, ගිණුමක් විතරක්, හෝ පණිවිඩයේම කරන්සිය ලියා තිබුණොත් ඒ පියවර ඉබේම මග හැරේ.)
Commands: `/help` · `/cancel` · `/id`

## සවි කිරීම (එක් වරක් විතරයි)

1. **Bot එක හදන්න** - Telegram හි `@BotFather` → `/newbot` → ලැබෙන **token** එක සුරකින්න.
2. **Table එක හදන්න** - Supabase dashboard (WealthFlow project) → SQL Editor එකේ
   `supabase/migrations/20261103000000_telegram_sessions.sql` ඇතුළත run කරන්න.
3. **Function එක project එකට දාන්න** - මේ zip එකේ `supabase/functions/telegram-bot/` folder එක ඔබේ
   `wealth-weaver\supabase\functions\` ඇතුළට copy කරන්න. `supabase\config.toml` අගට මේක එකතු කරන්න:
   ```
   [functions.telegram-bot]
   verify_jwt = false
   ```
4. **Secrets දාන්න** (PowerShell, `wealth-weaver` folder එකේ). WEBHOOK_SECRET = ඔබම හදන දිගු අහඹු text එකක්,
   USER_ID = Supabase → Authentication → Users හි ඔබේ user UUID:
   ```
   npx supabase secrets set TELEGRAM_BOT_TOKEN=<token> TELEGRAM_WEBHOOK_SECRET=<අහඹු-text> WEALTHFLOW_USER_ID=<user-uuid> --project-ref ontlcjvmztiprmzbtcmh
   ```
5. **Deploy**:
   ```
   npx supabase functions deploy telegram-bot --no-verify-jwt --project-ref ontlcjvmztiprmzbtcmh
   ```
6. **Webhook සම්බන්ධ කරන්න**:
   ```
   Invoke-RestMethod "https://api.telegram.org/bot<token>/setWebhook?url=https://ontlcjvmztiprmzbtcmh.supabase.co/functions/v1/telegram-bot&secret_token=<අහඹු-text>"
   ```
7. **ඔබේ chat id එක දාන්න** - Telegram හි bot ට `/id` එවන්න (ඔබේ chat id එක පෙන්වයි), ඊට පස්සේ:
   ```
   npx supabase secrets set TELEGRAM_ALLOWED_CHAT_ID=<chat-id> --project-ref ontlcjvmztiprmzbtcmh
   ```
   මේ chat id එකෙන් පිටත කිසිවෙකුට bot එක පාවිච්චි කළ නොහැක.
8. **(නිර්දේශිතයි) Review dialog patch** - `wealth-weaver` folder එකේ `powershell -ExecutionPolicy Bypass -File patch-confirm-dialog.ps1`
   run කරන්න, ඊට පස්සේ `npm run build`. මේකෙන් Draft එකේ තෝරපු ගිණුම Review & Confirm dialog එකේ default වෙනවා
   (නැත්නම් dialog එක පළමු ගිණුම පෙන්වයි).

## සටහන්
- Transfer නම් bot එකෙන් නොහැක (drafts වලට Income/Expense විතරයි). Transfer එක app එකේ කරන්න.
- Draft එක ඉබේම post වෙන්න ඕන නම් app එකේ SMS Imports හි එම draft එකේ **auto-post** switch එක on කරන්න.
- Bot token එක කාටවත් නොදෙන්න. Token එක කාන්දු වුණොත් @BotFather හි `/revoke` කරන්න.
