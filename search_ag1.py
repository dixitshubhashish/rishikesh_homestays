import time
import os
import csv
from duckduckgo_search import DDGS

platforms = [
    ('Booking.com', 'booking.com'),
    ('MakeMyTrip', 'makemytrip.com'),
    ('Goibibo', 'goibibo.com'),
    ('Agoda', 'agoda.com'),
    ('Airbnb', 'airbnb.co.in'),
    ('EaseMyTrip', 'easemytrip.com'),
    ('Hotels.com', 'hotels.com'),
    ('Expedia', 'expedia.co.in'),
    ('Trip.com', 'trip.com'),
    ('Cleartrip', 'cleartrip.com'),
    ('Yatra', 'yatra.com'),
    ('OYO', 'oyorooms.com'),
    ('Treebo', 'treebo.com'),
    ('FabHotels', 'fabhotels.com')
]

input_file = "docs/antigravity/no-link-stays.tsv"
output_file = "docs/antigravity/results-ag1.tsv"

with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='\t')
    rows = list(reader)[:200]

ddgs = DDGS()

def clean_url(url):
    return url.split('?')[0] if 'airbnb' in url else url

out_f = open(output_file, 'w', encoding='utf-8')

verified_count = 0
none_count = 0

for row in rows:
    key = row['key']
    name = row['name']
    city = row['city']
    
    found_links = []
    
    for plat_name, domain in platforms:
        if len(found_links) >= 2:
            break
            
        query = f'site:{domain} "{name}" {city}'
        print(f"Searching: {query}")
        
        try:
            results = list(ddgs.text(query, max_results=3))
            
            # Fallback without quotes if no results
            if not results:
                query_no_quotes = f'site:{domain} {name} {city}'
                print(f"Fallback Searching: {query_no_quotes}")
                results = list(ddgs.text(query_no_quotes, max_results=3))
                
            for res in results:
                url = res.get('href', '')
                title = res.get('title', '')
                if domain in url:
                    url = clean_url(url)
                    out_f.write(f'{key}\tverified\t{plat_name}\t{url}\tpage title as shown: "{title}"\n')
                    out_f.flush()
                    found_links.append(plat_name)
                    verified_count += 1
                    break # only one link per platform
        except Exception as e:
            print(f"Error searching {query}: {e}")
            
        time.sleep(1) # Human pace
        
    if not found_links:
        tried = ", ".join([p[0] for p in platforms])
        out_f.write(f'{key}\tnone\t-\t-\tsearched: {tried}; nothing matched\n')
        out_f.flush()
        none_count += 1

out_f.close()
print(f"DONE. Verified lines: {verified_count}, None lines: {none_count}")
