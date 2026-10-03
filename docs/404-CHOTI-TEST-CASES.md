# 404 Choti Acceptance Tests

Local URL: http://localhost:3000/404
Live URL: https://rishikeshhomestays.com/404

## Acceptance Rule

The guide must have a clearly visible ponytail attached naturally behind his
head, matching the approved portrait. A bald head, forehead tuft, floating SVG,
or clipped ponytail fails. Image loading alone does not establish a pass.

Use viewport dimensions in CSS pixels, browser zoom 100%, and a fresh reload.
Cancel the automatic home redirect using the page's stay option before testing.
Run each case locally and again on the live site after deployment. Capture a
full-page screenshot and a close-up of the guide for each viewport.

## Viewport Cases

| ID | Viewport | Coverage | Expected result |
| --- | --- | --- | --- |
| C01 | 320 x 568 | Small phone | Portrait artwork; choti visible, no horizontal overflow |
| C02 | 390 x 844 | Phone | Approved portrait; ponytail and complete head visible |
| C03 | 430 x 932 | Large phone | Portrait artwork; same natural ponytail placement |
| C04 | 760 x 1024 | Last mobile width | Portrait source selected; choti visible |
| C05 | 761 x 1024 | First non-mobile width | Landscape/wide source; choti still visible |
| C06 | 768 x 1024 | Tablet portrait | Choti visible in selected landscape artwork |
| C07 | 1024 x 768 | Tablet landscape | Choti visible; no clipping or overlapping text |
| C08 | 1280 x 800 | Small laptop | Choti visible in wide/stacked layout |
| C09 | 1366 x 768 | Laptop | Choti visible regardless of stacked/side-by-side decision |
| C10 | 1440 x 900 | Large laptop | Choti visible in selected landscape artwork |
| C11 | 1920 x 1080 | Desktop | Choti visible; complete head within image bounds |
| C12 | 3440 x 1440 | Ultrawide | Choti visible even when scene is expanded across the page |

At every size, verify that the image decoded, the guide's head and ponytail are
unobscured, the 404 sign remains readable, and text/contact controls do not
overlap the subjects. Record the visible image's URL, not just the hidden
picture element's source. Layout depends on container width and a script that
can select the stacked wide artwork even at desktop sizes.

## Interaction And Deployment Cases

| ID | Action | Expected result |
| --- | --- | --- |
| C13 | Resize 390 -> 761 -> 1440 -> 390 without reloading | Artwork switches correctly; choti remains visible at every step |
| C14 | Rotate tablet 768 x 1024 -> 1024 x 768 | Choti remains visible after orientation/layout change |
| C15 | Open and close WhatsApp drawer at 1440 x 900 | Choti remains visible through any resulting layout/source switch; close restores page width |
| C16 | Test at 200% browser zoom | Responsive artwork retains visible choti; controls remain usable |
| C17 | Enable reduced motion and reload | Static artwork still has choti; animation is not needed to show it |
| C18 | Open a nonexistent route, e.g. /choti-qa-missing-page | Custom page returns HTTP 404 and renders the same corrected artwork |
| C19 | Open /404 and /404.html | Redirects resolve to the custom page and use the same corrected assets |
| C20 | Hard reload live page with cache disabled | Live HTML and all three WebPs match the approved local release; no old SVG choti overlay |
| C21 | Inspect each WebP directly | Mobile, standard landscape and wide artwork each contain the ponytail in their pixels |

Repeat representative phone, tablet and laptop cases in Chromium, Firefox,
and Safari. Include a real phone/tablet check when those devices are available.

## Known Evidence Before Fix

- Local mobile WebP: inspected visually; ponytail present, matches approved portrait.
- Local standard and wide WebPs: inspected visually; ponytail absent.
- Live mobile WebP: inspected visually; ponytail absent and differs from local.
- Live standard and wide WebPs: hashes match local versions with no ponytail.
- Live HTML: still contains the old SVG choti overlay removed locally.
- Owner's local laptop/desktop screenshot: wide artwork has no visible ponytail.

These are asset/source findings, not completed browser runs for the matrix.
Do not accept the current screenshot as a corrected visual baseline.

## Result Record

For each case record: environment, browser/version, CSS viewport, visible
artwork URL, pass/fail, screenshot path, and defect notes. Release requires all
viewport cases to pass visually in both environments; automated load/layout
checks cannot determine whether the artwork depicts a natural ponytail.
