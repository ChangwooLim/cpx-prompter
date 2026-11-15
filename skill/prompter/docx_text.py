import re
import sys
import zipfile
from html import unescape

xml = zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode("utf-8")
for para in re.findall(r"<w:p\b.*?</w:p>|<w:p\b[^>]*/>", xml, re.S):
    out = []
    for run in re.findall(r"<w:r\b.*?</w:r>", para, re.S):
        run = re.sub(r"<w:(tab|br)\b[^>]*/>", " ", run)
        text = unescape("".join(re.findall(r"<w:t\b[^>]*>(.*?)</w:t>", run, re.S)))
        italic = re.search(r"<w:i/>|<w:i w:val=\"(1|true)\"/>", run)
        out.append(f"*{text}*" if text.strip() and italic else text)
    heading = re.search(r'<w:pStyle w:val="Heading(\d)"', para)
    prefix = "#" * int(heading.group(1)) + " " if heading else ""
    print(prefix + "".join(out).replace("**", ""))
