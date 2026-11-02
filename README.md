# Wealth Wise (eco-wise)

A classroom board game for AP9 Economics. Players build a character, roll the dice, answer 10 multiple-choice questions, and earn badges. Finished rounds are saved to a simple JSON database so the teacher can see everyone's scores later.

## What is in this folder

| File | What it does |
|---|---|
| `index.html` | The whole game (one file, no build step) |
| `api/scores.js` | Saves and returns the class records (the JSON database) |
| `dev-server.mjs` | Lets you try everything on your computer |
| `package.json` | Lists the one dependency, `@vercel/blob` |

## Put it online with Vercel

1. **Upload this folder to your GitHub repo** (`benedict-aicontent/eco-wise`). Either drag the files into the repo on github.com ("Add file", then "Upload files"), or from this folder run:
   ```
   git init
   git add .
   git commit -m "Wealth Wise"
   git branch -M main
   git remote add origin https://github.com/benedict-aicontent/eco-wise.git
   git push -u origin main
   ```
2. **Import it in Vercel.** vercel.com, "Add New", "Project", pick `eco-wise`, leave every setting as it is, and press Deploy. The game works right away at an address like `eco-wise.vercel.app`.
3. **Turn on the score database.** In the project, open the **Storage** tab, create a **Blob** store, and connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` for you.
4. **Set the teacher PIN.** Project, Settings, Environment Variables, add `TEACHER_PIN` with a PIN only you know.
5. **Redeploy** (Deployments, the three dots, Redeploy) so the new settings take effect.

To see scores: open the game, choose **View records**, enter the PIN, and press **Load records**. You can download a CSV or clear everything from the same screen.

A custom `.app` address is optional. Buy the domain from any registrar, then add it under Project, Settings, Domains.

## How the database works

Each finished round is saved as one small JSON file in Vercel Blob (`scores/...json`), for example:

```json
{ "name": "Maria", "score": 75, "correct": 5, "total": 10, "badges": ["lap", "perfect"], "at": "2026-11-02T03:58:51.163Z" }
```

Vercel's servers cannot keep ordinary files, so Blob is where the JSON lives online. One file per round means two students finishing at the same moment never overwrite each other. Anyone can send a score, but only someone with the PIN can read or delete them. If the server can't be reached, the score is still kept on that student's device.

## Try it on your computer

```
npm install
npm run dev
```

Open http://localhost:3000. Locally, records go into `data/scores.json` and the PIN is `1234` unless you set `TEACHER_PIN`.

## Edit the questions

Open `index.html` and find `const QS={`. There are three lists: `E` (Easy, +10), `A` (Average, +15) and `D` (Difficult, +25). Each question is one line:

```js
{q:'Question text',a:'Correct answer',o:['Wrong 1','Wrong 2','Wrong 3']},
```

A round asks 10 questions and never repeats one. Keep the total at 10 or more.

## Phones

The layout switches automatically when a phone is turned sideways (the phone's auto-rotate must be on). On Android, the **Landscape full screen** button also locks the screen to landscape. iPhones do not allow a web page to lock rotation.
