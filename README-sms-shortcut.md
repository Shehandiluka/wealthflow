# බැංකු SMS → WealthFlow Draft (Apple Shortcut)

SMS එක ආපු ගමන් Draft Inbox එකට draft එකක් වැටෙනවා. app එකට ගිහින් confirm කරන්න, නැත්නම් "Split into several items" එකෙන් කොටස් කිහිපයකට කඩන්න.

## 1. API key එක හදන්න (එක පාරයි)
WealthFlow → Settings → SMS import → අලුත් key එකක් හදන්න.
- Label: `FriMi`
- Default wallet: ඔයාගේ FriMi wallet එක (draft එකේ wallet එක මේකෙන් තේරෙනවා)
- key එක copy කරගන්න (ආයෙ පේන්නේ නැහැ).

## 2. Shortcut Automation එක
Shortcuts app → Automation → **+** → **Message**
- **Message Contains:** `FriMi`  (Sender එක හිස්ව තියන්න)
- **Run Immediately** තෝරන්න, "Notify When Run" off.
- Next → **New Blank Automation** → action එක: **Get Contents of URL**

| Field | Value |
|---|---|
| URL | `https://ontlcjvmztiprmzbtcmh.supabase.co/functions/v1/sms-import` |
| Method | `POST` |
| Headers | `x-api-key` = ඔයාගේ key එක |
| Request Body | `JSON` |
| `sender` (Text) | `FriMiSMS` |
| `message` (Text) | **Shortcut Input** → **Content** |
| `receivedAt` (Text) | **Current Date** → Date Format: **ISO 8601**, Include Time on |

වෙන බැංකුවක් එකතු කරන්න ඕන නම් ඒකට වෙනම automation එකක් (වෙන "Message Contains" වචනයක්, වෙන `sender` නමක්, අවශ්‍ය නම් වෙන key එකක්) හදන්න.

## 3. Draft එකේ පිරෙන දේවල්
| SMS වර්ගය | පිරෙන දේ |
|---|---|
| Fund Transfer | මුදල, expense, දිනය, balance, "Transfer to 78XXXX64" |
| POS Transaction | මුදල, expense, "Card: NETFLIX.COM Amsterd" |
| BILL PAYMENT | මුදල, expense, "Bill: Dialog Fixed Solutions" |

Category එකයි ඉතිරි විස්තරයි ඔයා confirm කරන වෙලාවේ දාන්න.

## 4. කොටස් කිහිපයකට කඩන්න (Split)
Draft එක open කරලා **Split into several items** → item එකකට මුදල, category, note දාන්න → **Add item**. අලුත් item එකට ඉතිරි මුදල auto වැටෙනවා. එකතුව මුළු මුදලට සමාන උනාම විතරයි Confirm වෙන්නේ. හැම item එකක්ම එකම wallet එකෙන් වෙනම transaction එකක් විදියට save වෙනවා.

## 5. Deploy
```
supabase functions deploy sms-import --project-ref ontlcjvmztiprmzbtcmh
npm run deploy
```
