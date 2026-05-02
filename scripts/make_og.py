"""Generate og.png — 1200x630 share preview. Stoic, basic."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sydney" / "og.png"
OUT.parent.mkdir(exist_ok=True)

W, H = 1200, 630
BG = (245, 247, 250)
TEXT = (28, 34, 48)
MUTED = (93, 102, 120)
ACCENT = (37, 99, 235)
BORDER = (227, 231, 238)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# Try to find a bold sans font
def find_font(size, bold=False):
    candidates = (
        ["arialbd.ttf", "Arial Bold.ttf", "Helvetica-Bold.ttf", "DejaVuSans-Bold.ttf"]
        if bold
        else ["arial.ttf", "Arial.ttf", "Helvetica.ttf", "DejaVuSans.ttf"]
    )
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    for p in (
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
        r"/Library/Fonts/Arial Bold.ttf" if bold else r"/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()

f_title = find_font(112, bold=True)
f_sub = find_font(40, bold=False)
f_label = find_font(26, bold=True)
f_small = find_font(22, bold=False)

# Card with subtle border
card = (60, 60, W - 60, H - 60)
d.rectangle(card, fill=(255, 255, 255), outline=BORDER, width=1)

# Domain pill in top-left of card
pill_pad_x, pill_pad_y = 14, 8
pill_x, pill_y = card[0] + 50, card[1] + 50
pill_text = "canibuyhere.com"
text_w = d.textlength(pill_text, font=f_label)
d.rounded_rectangle(
    (pill_x, pill_y, pill_x + text_w + pill_pad_x * 2, pill_y + 24 + pill_pad_y * 2),
    radius=18, fill=(241, 244, 248)
)
d.text((pill_x + pill_pad_x, pill_y + pill_pad_y - 2), pill_text, fill=ACCENT, font=f_label)

# Headline + sub
title_x = card[0] + 50
title_y = card[1] + 170
d.text((title_x, title_y), "Can I buy here?", fill=TEXT, font=f_title)
d.text((title_x, title_y + 150), "Sydney suburbs you can afford on your salary.", fill=MUTED, font=f_sub)

# Affordability gradient strip near bottom
def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

GREEN = (46, 204, 113)
AMBER = (241, 196, 15)
RED = (231, 76, 60)

strip_y = H - 130
strip_h = 14
strip_x0 = card[0] + 50
strip_x1 = card[2] - 50
for i in range(strip_x0, strip_x1):
    t = (i - strip_x0) / (strip_x1 - strip_x0)
    if t < 0.5:
        c = lerp(GREEN, AMBER, t / 0.5)
    else:
        c = lerp(AMBER, RED, (t - 0.5) / 0.5)
    d.line([(i, strip_y), (i, strip_y + strip_h)], fill=c)

# Strip caption
d.text((strip_x0, strip_y - 36), "Affordable", fill=GREEN, font=f_label)
mid_text = "Stretch"
mid_w = d.textlength(mid_text, font=f_label)
d.text(((strip_x0 + strip_x1) / 2 - mid_w / 2, strip_y - 36), mid_text, fill=AMBER, font=f_label)
end_text = "Unaffordable"
end_w = d.textlength(end_text, font=f_label)
d.text((strip_x1 - end_w, strip_y - 36), end_text, fill=RED, font=f_label)

img.save(OUT, "PNG", optimize=True)
print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")
