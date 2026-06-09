import re
import unicodedata


def to_slug(text: str) -> str:
    """Convert Vietnamese text to URL-friendly slug.

    Example: "Triệu Vân" -> "trieu-van"
    """
    # Normalize unicode to decomposed form (NFD) to separate base chars from diacritics
    text = unicodedata.normalize("NFD", text)
    # Remove diacritic marks (combining characters)
    text = re.sub(r"[\u0300-\u036f]", "", text)
    # Convert to lowercase
    text = text.lower()
    # Replace any non-alphanumeric, non-space characters
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    # Replace whitespace with hyphens
    text = re.sub(r"[\s]+", "-", text)
    # Collapse multiple hyphens
    text = re.sub(r"-+", "-", text)
    # Strip leading/trailing hyphens
    text = text.strip("-")
    return text
