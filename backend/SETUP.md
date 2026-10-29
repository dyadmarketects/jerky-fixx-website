# Jerky Fixx form backend: setup

This connects the forms on jerkyfixx.com (orders, questions, VIP Club, event alerts) to a Google Sheet and sends an email for every submission. It takes about 10 minutes and works from a phone, though a laptop is easier.

Phone tip: the Apps Script editor is cramped on a phone. If buttons look missing, open your browser menu and turn on "Desktop site".

## Set up

1. Sign in to Google as **dyadmarketects@gmail.com**. This account will own the sheet and send the emails.
2. Go to https://sheets.google.com and tap **Blank spreadsheet** (the + button).
3. Tap the title at the top ("Untitled spreadsheet") and rename it exactly: **Jerky Fixx Website Leads**
4. Tap **Extensions**, then **Apps Script**. A new tab opens with a file called `Code.gs`.
5. Select everything in `Code.gs` and delete it. Then open the `Code.gs` file from this folder, copy all of it, and paste it in.
6. Tap the **Save** icon (disk) at the top.
7. Tap **Deploy** (top right), then **New deployment**.
8. Tap the gear icon next to "Select type" and choose **Web app**.
9. Fill in:
   - Description: `Jerky Fixx forms`
   - **Execute as: Me** (dyadmarketects@gmail.com)
   - **Who has access: Anyone**
10. Tap **Deploy**.
11. Google asks you to **Authorize access**. Tap it, choose the dyadmarketects account, and if you see "Google hasn't verified this app", tap **Advanced**, then **Go to Untitled project (unsafe)**, then **Allow**. This is your own script, so it is safe. It needs permission to edit your sheet and send email.
12. Copy the **Web app URL**. It ends in `/exec`. Save it somewhere safe, like a note to yourself.
13. Go back to the Google Sheet, tap **Share**, add **jerkyfixx@gmail.com** and set the role to **Editor**. Tap Send.
14. Connect the website, either way:
    - Paste the URL into `FORM_ENDPOINT` near the top of `index.html` (search for `FORM_ENDPOINT`), or
    - Just tell Claude the URL and ask it to wire it in.

## Test it

1. Open the `/exec` URL in your browser. You should see exactly this:
   `{"ok":true,"service":"jerkyfixx-forms"}`
   If you see that, the web app is live.
2. Optional full test: in the Apps Script editor, pick **testOrder** in the function dropdown (next to Run/Debug) and tap **Run**. It adds a row to a new **Orders** tab in the sheet and sends real emails to jerkyfixx@gmail.com and dyadmarketects@gmail.com. Delete the test row afterward.
3. Then submit a real form on the live site and check the sheet and both inboxes. If emails land in Spam the first time, mark them "Not spam".

The tabs (Orders, Contact, VIP Club, Event Alerts) are created automatically the first time each form is used.

## Changing the code later (redeploy)

Saving the code is not enough. The live URL keeps running the old version until you publish a new one:

1. Open the sheet, then **Extensions**, then **Apps Script**, and make your edit. Tap **Save**.
2. Tap **Deploy**, then **Manage deployments**.
3. Tap the pencil (**Edit**) on the active deployment.
4. Under Version, choose **New version**, then tap **Deploy**.

The `/exec` URL stays the same, so nothing on the website needs to change. (If you pick **New deployment** instead, you get a different URL.)

To change who gets the emails, edit `NOTIFY_EMAILS` at the top of `Code.gs`, then redeploy as above.

## Email limits (please read)

A free Gmail account can send about **100 emails per day** from a script, and the limit counts every recipient. That means:

- Each order uses **3** (one to each Jerky Fixx inbox, plus the customer confirmation), so roughly 33 orders a day.
- Each question, VIP signup or event signup uses **2**.

The limit resets daily. If it is ever hit, the form still works and the row is still saved in the sheet. Only the emails stop until the next day, so check the sheet if things go quiet. Google Workspace accounts get a higher limit.

## Spam protection

Submissions are quietly ignored (the visitor sees a normal "thanks" but nothing is saved or emailed) if the hidden honeypot field is filled, the form was sent in under 2.5 seconds, or the "I'm not a robot" box was not ticked. To see what was blocked, open Apps Script, tap **Executions**, and look at the log lines.
