# Windows setup

This guide assumes no development experience.

## First-time installation

1. Install the current Node.js 24 LTS release from the official Node.js website. Accept the default Windows installer options.
2. Open Windows Terminal or PowerShell.
3. Enter:

   ```powershell
   git clone https://github.com/MuhammedJshi96/LabSpace-AI-Indexer.git
   cd LabSpace-AI-Indexer
   npm ci
   npm run dev
   ```

4. Wait until the terminal reports that LabSpace Indexer is available.
5. Open [http://127.0.0.1:3004/](http://127.0.0.1:3004/) in a modern browser.

Leave the terminal window open while using the application. Press `Ctrl+C` in that terminal to stop it.

## Daily start

```powershell
cd <path-to>\LabSpace-AI-Indexer
npm run dev
```

Your project reopens from `<repository>\data\labspace-indexer.sqlite`.

## Back up or move a project

Open the menu in the upper-left corner and choose **Export project**. The downloaded JSON file contains the complete versioned project data. To restore it, choose **Open JSON**.

For a file-level backup, stop the application and copy `<repository>\data\labspace-indexer.sqlite` to another local drive. Do not copy a database while a save is in progress.

## Production mode

```powershell
cd <path-to>\LabSpace-AI-Indexer
npm run build
npm run start
```

## Troubleshooting

- **The page does not open:** confirm `npm run dev` is still running and use `127.0.0.1`, not another computer name.
- **Port 3004 is busy:** close the other local program using port 3004, or set a different `PORT`, then restart.
- **SQLite module error:** confirm `node --version` reports Node 22.5 or newer; Node 24 LTS is recommended.
- **A blank or stale page appears:** press `Ctrl+F5` once.
- **Browser tests cannot find Chromium:** run `npx playwright install chromium`, then retry `npm run test:e2e`.
- **Reset demonstration data:** rename the database while the app is stopped; the next start creates the Room 809 seed. Keep the renamed copy as a backup.

No administrator access, cloud account, API key, or paid service is required after Node.js is installed.
