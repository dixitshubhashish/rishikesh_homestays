"""Import the owner's checks from the "Rishikesh Stays – Booking Links to Review"
Google Sheet back into ota-links.tsv.

Sheet: https://docs.google.com/spreadsheets/d/1KI8La77lRZlNsp7NrGeppS8IiIKIWXDlXl65ktSSNFE
Usage: download it as CSV (File > Download > CSV), then
       python3 scripts/stays/import_review.py <sheet.csv>
       python3 scripts/stays/build_pages.py

A row with Confirmed = Y becomes 'verified', using "Your site"/"Your URL"
when filled in, else the candidate. Confirmed = N marks it 'none' so it is
not suggested again. Blank rows are left as they are.
"""
import csv, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
out = []
for row in csv.DictReader(open(sys.argv[1], newline='')):
    flag = (row.get('Confirmed (Y/N)') or '').strip().upper()
    if flag not in ('Y', 'N'):
        continue
    site = (row.get('Your site') or '').strip() or (row.get('Candidate site') or '').strip()
    url = (row.get('Your URL') or '').strip() or (row.get('Candidate URL') or '').strip()
    if flag == 'Y' and url.startswith('https://') and site:
        out.append([row['Key'], 'verified', site, url, 'confirmed by owner in review sheet'])
    elif flag == 'N':
        out.append([row['Key'], 'none', '-', '-', 'rejected by owner in review sheet'])
with tempfile.NamedTemporaryFile('w', suffix='.tsv', delete=False) as fh:
    fh.write(''.join('\t'.join(r) + '\n' for r in out))
print(f'{len(out)} reviewed rows')
subprocess.run([sys.executable, os.path.join(HERE, 'merge_ota.py'), fh.name], check=True)
