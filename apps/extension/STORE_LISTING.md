# Chrome Web Store submission

Everything the Chrome Web Store developer dashboard asks for, ready to paste.

## 1. Build the package

```bash
cd apps/extension
WXT_API_URL=https://your-bookbot-domain npm run zip
```

This creates `.output/extension-<version>-chrome.zip`. Upload that file. The build refuses to run without an `https://` address, so a store build can never point at `localhost`. Raise `version` in `apps/extension/package.json` for every new upload.

To change the icon, edit the SVG in `scripts/make-icons.mjs` and run `npm run icons`.

## 2. Store listing

**Name**: see the note on the name at the end before submitting.

**Summary** (132 characters max):

> See estimated daily and monthly sales for books on Amazon, right on search results and product pages, and save books to Bookbot.

**Description:**

> Bookbot shows you how well books sell on Amazon, without leaving the page.
>
> • Sales estimates on search results: every book with a Best Sellers Rank gets an estimate of its daily and monthly sales.
> • Book details at a glance: on a book's page, see its rank, category, price, reviews and estimated sales in one panel.
> • Save books to Bookbot: track books you want to study, then research their niche and keywords in your Bookbot workspace.
>
> Works on Amazon.com, .co.uk, .de, .fr, .es, .it and .co.jp.
>
> Requires a Bookbot account. In Bookbot, go to Settings → Extension, create a token, and paste it into the extension's popup.

**Category**: Productivity (or Shopping)

**Language**: English

**Images** (you need to make these yourself; they must show the real extension):

- Store icon 128×128: `src/public/icon/128.png`
- At least one screenshot at 1280×800 or 640×400. Good choices:
  1. Amazon search results with the Bookbot estimates under each book
  2. A book page with the Bookbot panel open
  3. The popup with a connected account
- Optional small promo tile, 440×280

## 3. Privacy practices tab

**Single purpose:**

> Show sales estimates for books on Amazon store pages and let the user save books to their Bookbot account.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `storage` | Stores the user's Bookbot access token, which they paste into the popup, so they don't have to enter it again. |
| Host permission for the Bookbot address | The extension sends book details to the user's Bookbot account to calculate sales estimates and save books. |
| Content script on Amazon domains | Reads the rank, category, price and reviews shown on Amazon search and product pages to display estimates next to each book. |

**Remote code**: No. All code is in the package.

**Data usage:** check only **Website content** (the public book details read from Amazon pages). Do *not* check personally identifiable info, health, financial, authentication, personal communications, location, web history or user activity.

> The extension does read the user's own access token, but only to send it back to the Bookbot API that issued it. If the review asks, describe it under "Authentication information": "an API token the user creates in Bookbot, used only to authenticate requests to Bookbot."

Then confirm all three certifications: data isn't sold, isn't used for unrelated purposes, and isn't used for credit decisions.

**Privacy policy URL**: `https://your-bookbot-domain/privacy`. The page is in the web app. Set `NEXT_PUBLIC_SUPPORT_EMAIL` in production so it shows a contact address.

## 4. Before you submit

- [ ] The web app is live at the address used in `WXT_API_URL`, and `/privacy` loads without signing in
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` is set on the live site
- [ ] Screenshots are taken from the real extension
- [ ] You tested the zip: in `chrome://extensions`, turn on Developer mode, drag in the zip (or "Load unpacked" with `.output/chrome-mv3`), add a token, then open an Amazon search
- [ ] Developer account registered (a one-time fee) and contact email verified

## A note on the name

The current name, **"Bookbot KDP Spy"**, has two risks in review:

- **"KDP"** is Amazon's trademark. The store rejects names that suggest an official connection to another company.
- **"KDSPY"** is the name of an existing, popular KDP research extension, so "KDP Spy" may be seen as copying it.

A safer name keeps your brand first and describes what it does, for example **"Bookbot – Book Sales Estimator"**. You can still mention Amazon and KDP in the description, as above. The name is in `wxt.config.ts` (`manifest.name`).
