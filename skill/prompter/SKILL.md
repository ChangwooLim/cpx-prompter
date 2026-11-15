---
name: prompter
description: Convert a CPX script (.docx, .txt, .md, or pasted text) into cpx-prompter/1 JSON for the CPX prompter page at https://changwoolim.github.io/cpx-prompter/. Use for /prompter, "프롬프터 json 만들어줘", "이 대본 프롬프터 양식으로 바꿔줘".
argument-hint: <대본 파일 경로, 또는 대본 붙여 넣기>
---

# /prompter

Turn one CPX script into one `cpx-prompter/1` JSON file that the prompter page loads. Files below live in this skill's base directory.

1. Get the script text.
   - `.docx`: `python3 docx_text.py "<file>"`. It prints one paragraph per line, marks Word headings with `#`, and wraps italic runs in `*…*`, which usually mark acting directions.
   - `.txt` or `.md`: read the file.
   - Pasted text: use it as given. No script at all: ask for one and stop.
2. Convert it with the format and rules in `prompt.md`. That file is the contract. Copy dialogue verbatim and never invent section times.
3. Write `<source name>.prompter.json` next to the source file, or in the current directory for pasted text. UTF-8, 2-space indent.
4. Run `node validate.mjs "<output>"`. Fix the JSON and rerun until it prints `OK`.
5. Reply in Korean, briefly:
   - the output path and the validator's `OK` line;
   - when the length exceeds `limit`, say so and point at `[[생략 가능]]`;
   - the points `prompt.md` says to flag: odd order in the source, unclear speakers, sections you created;
   - `https://changwoolim.github.io/cpx-prompter/` 에서 "대본 불러오기"로 이 파일을 넣으면 된다는 안내.
