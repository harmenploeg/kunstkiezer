"""Waar de tussenbestanden van een oogstronde staan.

Elke stap leest en schrijft JSON in een werkmap, zodat een volgende stap verder kan
zonder opnieuw te downloaden. Zet `KK_OOGST_WERKMAP` om twee rondes gescheiden te
houden; standaard is dat `oogst-werk/` naast de huidige map.

De tussenbestanden horen niet in versiebeheer: ze zijn een momentopname van
externe sites, geen broncode. Alleen de uiteindelijke records gaan naar de database.
"""
import os
import sys

WERK = os.environ.get('KK_OOGST_WERKMAP') or 'oogst-werk'


def pad(naam):
    """Volledig pad naar een tussenbestand in de werkmap, die zo nodig wordt gemaakt."""
    os.makedirs(WERK, exist_ok=True)
    return os.path.join(WERK, naam)


def arg(n, standaard):
    """Argument n van de opdrachtregel, of de standaardnaam. Altijd in de werkmap.

    Zo draai je dezelfde stap over een tweede lijst zonder het bestand te kopieren:
        python3 detailpaginas.py sitemap-urls2.json server-details.json
    """
    return pad(sys.argv[n] if len(sys.argv) > n else standaard)
