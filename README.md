# Eco Wise

A classroom board game for AP9 Economics. Players build a character, roll the dice, answer 10 multiple-choice questions, and earn badges. Finished rounds are saved to a simple JSON database so the teacher can see everyone's scores later.

## What is in this folder

| File | What it does |
|---|---|
| `index.html` | The whole game (one file, no build step) |
| `questions.json` | **All the questions and answers. Edit this file to change them.** |
| `api/scores.js` | Saves and returns the class records (the JSON database) |
| `dev-server.mjs` | Lets you try everything on your computer |
| `package.json` | Lists the one dependency, `@vercel/blob` |

## Put it online with Vercel

1. **Upload this folder to your GitHub repo** (`benedict-aicontent/eco-wise`). Either drag the files into the repo on github.com ("Add file", then "Upload files"), or from this folder run:
   ```
   git init
   git add .
   git commit -m "Eco Wise"
   git branch -M main
   git remote add origin https://github.com/benedict-aicontent/eco-wise.git
   git push -u origin main
   ```
2. **Import it in Vercel.** vercel.com, "Add New", "Project", pick `eco-wise`, leave every setting as it is, and press Deploy. The game works right away at an address like `eco-wise.vercel.app`.
3. **Turn on the score database.** In the project, open the **Storage** tab, create a **Blob** store, choose **Public** access (the type can't be changed later, and the code expects Public), and connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` for you.
4. **Set the teacher PIN.** Project, Settings, Environment Variables, add `TEACHER_PIN` with a PIN only you know.
5. **Redeploy** (Deployments, the three dots, Redeploy) so the new settings take effect.

To see scores: open the game, choose **View records**, enter the PIN, and press **Load records**. You can download a CSV or clear everything from the same screen.

A custom `.app` address is optional. Buy the domain from any registrar, then add it under Project, Settings, Domains.

## How the database works

Each finished round is saved as one small JSON file in Vercel Blob (`scores/...json`), for example:

```json
{ "name": "Maria", "score": 75, "correct": 5, "total": 10, "badges": ["lap", "perfect"], "at": "2026-11-02T03:58:51.163Z" }
```

Vercel's servers cannot keep ordinary files, so Blob is where the JSON lives online. One file per round means two students finishing at the same moment never overwrite each other. Anyone can send a score, but only someone with the PIN can read or delete them through the game. (Public Blob files have long random addresses that are not listed anywhere, but they are not password-protected, so keep records to names and scores only.) If the server can't be reached, the score is still kept on that student's device.

## Try it on your computer

```
npm install
npm run dev
```

Open http://localhost:3000. Locally, records go into `data/scores.json` and the PIN is `1234` unless you set `TEACHER_PIN`.

## Edit the questions

All questions live in `questions.json`. You never need to touch `index.html`. On GitHub you can open the file, press the pencil icon, change it, and commit. Vercel redeploys by itself in about a minute.

The file has three sections, in this order: **Easy** (`multiple_choice`), **Average** (`true_false`) and **Hard** (`identification`). The first section is the green tiles, the second the yellow tiles and the third the red tiles.

**Multiple choice** (copy a whole `{ ... }` block to add a question, and put a comma between blocks):

```json
{
  "id": 8,
  "question": "Ano ang tawag sa pagtatabi ng pera?",
  "choices": { "A": "Pag-iimpok", "B": "Paggastos", "C": "Pangungutang", "D": "Pagbili" },
  "answer": "A"
}
```

**True or False:** `"answer": true` or `"answer": false` (no quotation marks).

**Identification:** `"answer": "Pag-iimpok"`. Capital letters, spaces, hyphens and accents are ignored when checking, so "pag iimpok" and "PAG-IIMPOK" are both marked correct. To accept other spellings add `"alsoAccept": ["pagtitipid"]`.

**Settings at the top of the file:**

| Setting | Meaning |
|---|---|
| `questionsPerRound` | How many questions each student answers (default 10). A round never repeats a question. |
| `shuffleChoices` | `true` mixes the order of A, B, C, D for each student. Use `false` to keep your order. |
| `pointsPerQuestion` | Points for a correct answer in that section (inside each section). |
| `level` | The name shown for that section, such as "Easy". |

The rules, the legend and the badges update to match the file. If the file has a mistake, the game shows a message such as "Easy question 2: the answer "Z" is not one of its choices" instead of starting. Fix the file and press Try again.

Students can see the answers if they open `questions.json` in their browser. That is fine for practice. For a graded test, keep the file private by moving the check to the server.

## Phones

The layout switches automatically when a phone is turned sideways (the phone's auto-rotate must be on). On Android, the **Landscape full screen** button also locks the screen to landscape. iPhones do not allow a web page to lock rotation.

## Free plan limits (Vercel Hobby)

The free plan has no end date. It is for personal, non-commercial use, and usage is counted per month. The limits that matter here:

- Website traffic: 100 GB a month and 1,000,000 requests. The game page is about 70 KB.
- Function calls: 1,000,000 a month. Each saved round and each "Load records" is one call.
- Blob storage: 1 GB, 10,000 reads and **2,000 uploads and listings** a month. Each saved round is one upload and each "Load records" is one listing, so about 2,000 rounds a month.
- Blob speed limit: 15 uploads a second. The game retries automatically when a whole class finishes at the same moment.
- Going over a limit does not cost money. That feature pauses for up to 30 days. The game still plays, and scores stay on each student's device.
