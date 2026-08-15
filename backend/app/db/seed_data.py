"""Fixed reference data seeded on every app startup (see init_db in database.py).

Lives in source code (not the DB) so a fresh install — or a wiped `data/`
volume — always has the full hero roster available immediately, without
needing to be re-entered by hand. Skins and everything else the user adds
through the UI still live only in the DB/MinIO and are untouched by this.
"""

LIEN_QUAN_HEROES = [
    "Airi", "Aleister", "Allain", "Alice", "Amily", "Annette", "Aoi", "Arduin",
    "Arum", "Astrid", "Ata", "Aya", "Azzen'Ka", "Baldum", "Bijan", "Biron",
    "Bonnie", "Bright", "Butterfly", "Capheny", "Celica", "Charlotte", "Chaugnar",
    "Cresht", "D'Arcy", "Dextra", "Dirak", "Eland'orr", "Elsu", "Enzo", "Erin",
    "Errol", "Florentino", "Gildur", "Grakk", "Hayate", "Helen", "Iggy", "Ilumia",
    "Ignis", "Ishar", "Jinna", "Kahlii", "Kaine", "Keera", "Kil'Groth", "Kriknak",
    "Krixi", "Krizzix", "Lauriel", "Laville", "Liliana", "Lindis", "Lu Bu",
    "Lorion", "Lumburr", "Marja", "Mganga", "Mina", "Ming", "Moren", "Murad",
    "Nakroth", "Natalya", "Ngo Khong", "Omega", "Omen", "Paine", "Preyta", "Qi",
    "Quillen", "Raz", "Riktor", "Rouie", "Roxie", "Ryoma", "Sephera", "Sinestrea",
    "Skud", "Slimz", "Stuart", "Superman", "Taara", "Tachi", "TeeMee", "Teeri",
    "Tel'Annas", "Thane", "The Flash", "Thorne", "Toro", "Trieu Van", "Tulen",
    "Valhein", "Veera", "Veres", "Violet", "Volkath", "Wiro", "Wisp",
    "Wonder Woman", "Y'bneth", "Yan", "Yena", "Yorn", "Yue", "Zata", "Zephys",
    "Zill", "Zip", "Zuka",
    # Added later, outside the original 111 — discovered via live data that
    # already had skins attached under these heroes (must stay seeded or a
    # fresh install would silently drop those skins on restore).
    "Điêu thuyền", "Richter", "Fennik", "Dolia", "Rourke", "Ormarr", "Billow",
    "Bolt Baron", "Arthur",
]
