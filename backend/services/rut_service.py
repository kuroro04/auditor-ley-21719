import re

# Espejo en Python de isValidRut en components/LoginCard.tsx — mismo
# algoritmo de módulo 11, para que el backend valide el RUT con la misma
# regla que ya se muestra al usuario en el formulario del frontend.


def normalize_rut(raw: str) -> str:
    return re.sub(r'[.\-\s]', '', raw).upper()


def is_valid_rut(raw: str) -> bool:
    clean = normalize_rut(raw)
    if not re.fullmatch(r'\d{7,8}[0-9K]', clean):
        return False

    body, dv_input = clean[:-1], clean[-1]
    total = 0
    multiplier = 2
    for digit in reversed(body):
        total += int(digit) * multiplier
        multiplier = 2 if multiplier == 7 else multiplier + 1

    remainder = 11 - (total % 11)
    dv_expected = '0' if remainder == 11 else 'K' if remainder == 10 else str(remainder)
    return dv_input == dv_expected
