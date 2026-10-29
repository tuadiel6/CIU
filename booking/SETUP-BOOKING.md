# Online booking: setup guide

The calendar on the "Book an appointment" page reads free times from a Google Sheet and writes each booking back to it. A small Google Apps Script (`Code.gs`) connects the two. It is free and takes about 15 minutes to set up once.

Until you finish step 6, the website shows the calendar with **example dates** and a notice that nothing is saved.

## 1. Create the sheet
1. Sign in to the Google account the centre will use (ideally a shared centre account, not a personal one).
2. Create a new Google Sheet and name it, for example, **CIU bookings**.

## 2. Add the script
1. In the sheet, open **Extensions → Apps Script**.
2. Delete the sample code, paste in everything from `booking/Code.gs`, and click **Save**.

## 3. Run setup once
1. In the function list at the top, choose **setup** and click **Run**.
2. Google asks for permission. Choose the centre's account, then **Advanced → Go to project → Allow**. The script needs to edit this sheet and send emails as you.
3. Return to the sheet. You now have four tabs: **Settings**, **Hours**, **Closed** and **Bookings**. The sheet's time zone is set to Africa/Kigali.

## 4. Set your hours
- **Hours**: one row per opening period. Use the full day name and 24-hour times, e.g. `Monday | 08:30 | 12:30`. Add a second row for the afternoon to leave a lunch break. The sample rows are examples; replace them.
- **Settings**:
  - `session_minutes`: length of one appointment (60).
  - `days_ahead`: how far ahead people can book (45).
  - `min_notice_hours`: the latest someone can book before a session (24).
  - `max_per_slot`: how many people can book the same time. Set it to 2 if two therapists can see clients at once.
  - `notify_email`: who gets an email for each new booking.
- **Closed**: add a date (`2026-12-25`) to close a whole day, or a date with start and end times to block part of a day.

## 5. Publish the script as a web app
1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

## 6. Connect the website
1. Open `script.js` and find this line at the top:
   ```js
   var BOOKING_API = '';
   ```
2. Paste your URL between the quotes:
   ```js
   var BOOKING_API = 'https://script.google.com/macros/s/AKfy..../exec';
   ```
3. Save, commit and push. The example notice disappears and real free times show.

## Daily use
- New bookings appear in the **Bookings** tab with status **Confirmed**, and an email goes to `notify_email`. If the visitor gave an email, they get a confirmation with their reference.
- **To cancel** a booking, change its Status to `Cancelled`. The time becomes free again on the website.
- **To book someone by phone**, choose the time on the website yourself so the slot is taken.

## If you change the script later
Use **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. This keeps the same URL. A "New deployment" creates a new URL, which you would then need to paste into `script.js` again.

## Privacy
The Bookings tab holds personal details. Keep the sheet shared only with staff who need it. The booking form asks visitors not to include medical details.
