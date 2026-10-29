# Centre Ishema ry'Umuryango — Website

Responsive, single-page static website for Centre Ishema ry'Umuryango (CIU), based on the CIU concept paper and the "Journey to happiness" emblem.

## Preview
Open `index.html` in a web browser. Keep `style.css`, `script.js` and the `assets` folder beside it.

## Publish
Upload the folder contents to a static host such as GitHub Pages, Netlify or your own web host. No build tools are required.

## Customize
- Text and sections: `index.html`
- Colours, fonts and layout: `style.css` (colour tokens are at the top, with a dark-mode set)
- Menu tabs (one page per tab, using `#home`, `#about`, `#services`, `#get-help`, `#team`, `#contact`), the light/dark toggle, copy buttons and the booking calendar: `script.js`
- Each section in `index.html` has a `data-page` attribute naming the tab(s) it appears on.
- The light/dark choice is remembered in the visitor's browser; with no choice, the site follows the device setting.
- Logo: `assets/ciu-logo.webp` (large) and `assets/ciu-mark.webp` (header, footer, browser icon). The original `assets/ciu-logo.png` is kept.

## Online booking
The "Book an appointment" page has a calendar. Visitors pick a free date and time, enter their details, and the appointment is confirmed straight away.
- Free times and bookings live in a Google Sheet, connected through the Google Apps Script in `booking/Code.gs`.
- Follow `booking/SETUP-BOOKING.md` to set it up, then paste the web app URL into `BOOKING_API` at the top of `script.js`.
- Until then, the calendar shows example dates with a notice that nothing is saved.

## Verification before launch
- Confirm both phone numbers (+250 788 733 368, +250 788 828 308) and the email address are active.
- Confirm the emergency numbers in the safety box: 112 (police), 116 (child helpline), 3029 (Isange One Stop Centre).
- Add the approved physical address, a privacy notice and any local legal disclosures.
